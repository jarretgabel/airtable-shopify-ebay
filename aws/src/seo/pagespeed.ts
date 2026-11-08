import type { Queryable } from '../db/sellersSummary.js';
import { logError, logInfo } from '../shared/logging.js';
import { DEFAULT_SITE_URL } from './crawl.js';

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const REQUEST_TIMEOUT_MS = 70_000;
const PER_TYPE_SAMPLE = 3;

export interface PageSpeedResult {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
}

export type JsonFetcher = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface LighthouseResponse {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, { numericValue?: number }>;
  };
}

const percent = (score: number | null | undefined) => (typeof score === 'number' ? Math.round(score * 100) : null);

export function parsePageSpeed(body: LighthouseResponse): PageSpeedResult | null {
  const result = body.lighthouseResult;
  if (!result?.categories) return null;
  const audit = (id: string) => {
    const value = result.audits?.[id]?.numericValue;
    return typeof value === 'number' ? value : null;
  };
  const round = (value: number | null) => (value === null ? null : Math.round(value));
  return {
    performance: percent(result.categories.performance?.score),
    accessibility: percent(result.categories.accessibility?.score),
    bestPractices: percent(result.categories['best-practices']?.score),
    seo: percent(result.categories.seo?.score),
    lcpMs: round(audit('largest-contentful-paint')),
    fcpMs: round(audit('first-contentful-paint')),
    tbtMs: round(audit('total-blocking-time')),
    cls: audit('cumulative-layout-shift'),
  };
}

export function buildPageSpeedUrl(pageUrl: string, apiKey?: string | null): string {
  const params = new URLSearchParams({ url: pageUrl, strategy: 'mobile' });
  for (const category of ['performance', 'accessibility', 'best-practices', 'seo']) params.append('category', category);
  if (apiKey) params.set('key', apiKey);
  return `${ENDPOINT}?${params.toString()}`;
}

async function fetchPageSpeed(fetcher: JsonFetcher, pageUrl: string, apiKey?: string | null): Promise<PageSpeedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(buildPageSpeedUrl(pageUrl, apiKey), { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'PageSpeed quota reached (add a PAGESPEED_API_KEY for a higher limit)' : `PageSpeed returned HTTP ${response.status}`);
    const parsed = parsePageSpeed(await response.json() as LighthouseResponse);
    if (!parsed) throw new Error('PageSpeed returned no scores');
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

/** Home page plus a few pages of each type; the pick rotates weekly so coverage widens over time. */
export async function pickSamplePages(db: Queryable, siteUrl: string): Promise<string[]> {
  const home = new URL('/', siteUrl).toString();
  const week = String(Math.floor(Date.now() / (7 * 86_400_000)));
  const { rows } = await db.query(
    `SELECT url FROM (
       SELECT url, row_number() OVER (PARTITION BY page_type ORDER BY md5(url || $1)) AS n
       FROM seo_pages WHERE status_code = 200 AND page_type <> 'home'
     ) ranked WHERE n <= $2 ORDER BY url`,
    [week, PER_TYPE_SAMPLE],
  );
  return [home, ...rows.map((row) => String(row.url))];
}

async function savePageSpeed(db: Queryable, url: string, result: PageSpeedResult | null, error: string | null): Promise<void> {
  if (!result) {
    // Keep the last good scores and only note the failure.
    await db.query(
      `INSERT INTO seo_pagespeed (url, strategy, error) VALUES ($1, 'mobile', $2) ON CONFLICT (url, strategy) DO UPDATE SET error = EXCLUDED.error`,
      [url, error],
    );
    return;
  }
  await db.query(
    `INSERT INTO seo_pagespeed (url, strategy, performance, accessibility, best_practices, seo, lcp_ms, fcp_ms, tbt_ms, cls, error, checked_at)
     VALUES ($1, 'mobile', $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (url, strategy) DO UPDATE SET performance = EXCLUDED.performance, accessibility = EXCLUDED.accessibility,
       best_practices = EXCLUDED.best_practices, seo = EXCLUDED.seo, lcp_ms = EXCLUDED.lcp_ms, fcp_ms = EXCLUDED.fcp_ms,
       tbt_ms = EXCLUDED.tbt_ms, cls = EXCLUDED.cls, error = EXCLUDED.error, checked_at = now()`,
    [url, result.performance, result.accessibility, result.bestPractices, result.seo, result.lcpMs, result.fcpMs, result.tbtMs, result.cls, error],
  );
}

export interface PageSpeedOptions {
  siteUrl?: string;
  fetcher?: JsonFetcher;
  apiKey?: string | null;
  /** Epoch ms after which no new page is started. */
  deadline?: number;
  delayMs?: number;
}

/** Runs sequentially: PageSpeed is slow and its shared quota rejects bursts. Never throws; failures are stored per page. */
export async function runPageSpeedSample(db: Queryable, options: PageSpeedOptions = {}): Promise<{ checked: number; failed: number }> {
  const siteUrl = options.siteUrl ?? DEFAULT_SITE_URL;
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const deadline = options.deadline ?? Date.now() + 8 * 60_000;
  const delayMs = options.delayMs ?? 1500;
  let checked = 0;
  let failed = 0;
  try {
    for (const url of await pickSamplePages(db, siteUrl)) {
      if (Date.now() + REQUEST_TIMEOUT_MS > deadline) break;
      try {
        await savePageSpeed(db, url, await fetchPageSpeed(fetcher, url, options.apiKey), null);
        checked += 1;
      } catch (error) {
        failed += 1;
        await savePageSpeed(db, url, null, error instanceof Error ? error.message : 'PageSpeed check failed');
      }
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    logInfo('PageSpeed sample finished', { checked, failed });
  } catch (error) {
    logError('PageSpeed sample failed', error);
  }
  return { checked, failed };
}
