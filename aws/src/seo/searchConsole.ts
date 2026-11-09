import { createSign } from 'node:crypto';
import type { Queryable } from '../db/sellersSummary.js';
import { logError, logInfo } from '../shared/logging.js';
import { getOptionalSecret } from '../shared/secrets.js';
import { gscProperty, type SeoSiteId } from './sites.js';

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DAILY_DAYS = 90;
const TOP_DAYS = 28;
const TOP_ROWS = 250;
// Search Console data is final about two days late.
const DATA_LAG_DAYS = 2;

export interface GscCredentials {
  client_email: string;
  private_key: string;
}

export type GscFetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function parseGscCredentials(raw: string | undefined | null): GscCredentials | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GscCredentials>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function getGscAccessToken(credentials: GscCredentials, fetcher: GscFetcher, nowMs = Date.now()): Promise<string> {
  const issued = Math.floor(nowMs / 1000);
  const unsigned = `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url({ iss: credentials.client_email, scope: SCOPE, aud: TOKEN_URL, iat: issued, exp: issued + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key, 'base64url');
  const response = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }).toString(),
  });
  const body = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? response.status}`);
  return body.access_token;
}

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

async function query(fetcher: GscFetcher, token: string, property: string, body: Record<string, unknown>): Promise<GscRow[]> {
  const response = await fetcher(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await response.json() as { rows?: GscRow[]; error?: { message?: string } };
  if (!response.ok) throw new Error(`Search Console ${response.status}: ${parsed.error?.message ?? 'request failed'}`);
  return parsed.rows ?? [];
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export type GscSyncResult = { synced: true; days: number; queries: number; pages: number } | { synced: false; reason: string };

export async function storeGscCredentials(db: Queryable, credentials: GscCredentials): Promise<void> {
  await db.query(
    `INSERT INTO seo_gsc_credentials (id, client_email, private_key) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET client_email = EXCLUDED.client_email, private_key = EXCLUDED.private_key, updated_at = now()`,
    [credentials.client_email, credentials.private_key],
  );
}

async function loadStoredCredentials(db: Queryable): Promise<GscCredentials | null> {
  const result = await db.query(`SELECT client_email, private_key FROM seo_gsc_credentials WHERE id = 1`);
  const row = result.rows[0] as { client_email?: string; private_key?: string } | undefined;
  return row?.client_email && row.private_key ? { client_email: row.client_email, private_key: row.private_key } : null;
}

/** Pulls daily totals plus the top queries and pages for one site. Never throws: a failure is stored for the dashboard. */
export async function syncSearchConsole(
  db: Queryable,
  site: SeoSiteId,
  options: { fetcher?: GscFetcher; credentials?: GscCredentials | null; nowMs?: number } = {},
): Promise<GscSyncResult> {
  const credentials = options.credentials === undefined
    ? (parseGscCredentials(getOptionalSecret('GSC_SERVICE_ACCOUNT_JSON')) ?? await loadStoredCredentials(db))
    : options.credentials;
  if (!credentials) return { synced: false, reason: 'Search Console credentials are not configured' };
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const nowMs = options.nowMs ?? Date.now();
  const property = gscProperty(site);
  const end = isoDay(nowMs - DATA_LAG_DAYS * 86_400_000);
  const dailyStart = isoDay(nowMs - (DAILY_DAYS + DATA_LAG_DAYS) * 86_400_000);
  const topStart = isoDay(nowMs - (TOP_DAYS + DATA_LAG_DAYS) * 86_400_000);
  try {
    const token = await getGscAccessToken(credentials, fetcher, nowMs);
    const [daily, queries, pages] = await Promise.all([
      query(fetcher, token, property, { startDate: dailyStart, endDate: end, dimensions: ['date'], rowLimit: 1000 }),
      query(fetcher, token, property, { startDate: topStart, endDate: end, dimensions: ['query'], rowLimit: TOP_ROWS }),
      query(fetcher, token, property, { startDate: topStart, endDate: end, dimensions: ['page'], rowLimit: TOP_ROWS }),
    ]);
    for (const row of daily) {
      await db.query(
        `INSERT INTO seo_gsc_daily (site, day, clicks, impressions, position) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (site, day) DO UPDATE SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, position = EXCLUDED.position`,
        [site, row.keys?.[0], row.clicks ?? 0, row.impressions ?? 0, row.position ?? null],
      );
    }
    await db.query(`DELETE FROM seo_gsc_queries WHERE site = $1`, [site]);
    for (const row of queries) {
      await db.query(
        `INSERT INTO seo_gsc_queries (site, query, clicks, impressions, ctr, position) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (site, query) DO NOTHING`,
        [site, row.keys?.[0], row.clicks ?? 0, row.impressions ?? 0, row.ctr ?? null, row.position ?? null],
      );
    }
    await db.query(`DELETE FROM seo_gsc_pages WHERE site = $1`, [site]);
    for (const row of pages) {
      await db.query(
        `INSERT INTO seo_gsc_pages (site, url, clicks, impressions, ctr, position) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (site, url) DO NOTHING`,
        [site, row.keys?.[0], row.clicks ?? 0, row.impressions ?? 0, row.ctr ?? null, row.position ?? null],
      );
    }
    await db.query(
      `INSERT INTO seo_gsc_syncs (site, synced_at, range_start, range_end, error) VALUES ($1, now(), $2, $3, NULL)
       ON CONFLICT (site) DO UPDATE SET synced_at = now(), range_start = EXCLUDED.range_start, range_end = EXCLUDED.range_end, error = NULL`,
      [site, dailyStart, end],
    );
    logInfo('Search Console sync finished', { site, days: daily.length, queries: queries.length, pages: pages.length });
    return { synced: true, days: daily.length, queries: queries.length, pages: pages.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : 'Search Console sync failed';
    logError('Search Console sync failed', error, { site });
    await db.query(
      `INSERT INTO seo_gsc_syncs (site, synced_at, error) VALUES ($1, now(), $2) ON CONFLICT (site) DO UPDATE SET synced_at = now(), error = EXCLUDED.error`,
      [site, message],
    ).catch(() => undefined);
    return { synced: false, reason: message };
  }
}
