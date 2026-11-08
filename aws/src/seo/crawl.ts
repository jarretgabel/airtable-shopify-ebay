import type { Queryable } from '../db/sellersSummary.js';
import { finishRun, hasActiveRun, startRun, upsertPage } from '../db/seo.js';
import { logError, logInfo } from '../shared/logging.js';
import { classifyUrl, extractSignals } from './htmlSignals.js';
import { failedPageScores, scorePage } from './scoring.js';
import { buildSiteChecks } from './siteChecks.js';

export const DEFAULT_SITE_URL = 'https://resolutionavnyc.com';
const USER_AGENT = 'ResolutionAV-SEO-Audit/1.0 (self-audit of resolutionavnyc.com)';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_DEPTH = 2;
const SKIP_EXTENSION = /\.(xml|json|txt|md|pdf|jpe?g|png|gif|webp|svg|css|js)(\?|$)/i;

export type Fetcher = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Pick<Response, 'ok' | 'status' | 'headers' | 'text'>>;

export interface SitemapEntry {
  url: string;
  lastModified: string | null;
}

export interface AuditOptions {
  siteUrl?: string;
  maxPages?: number;
  concurrency?: number;
  deadline?: number;
  fetcher?: Fetcher;
  /** Pause between a worker's requests, and the base for retry backoff. Tests set this to 0. */
  delayMs?: number;
}

async function timedFetch(fetcher: Fetcher, url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetcher(url, { signal: controller.signal, headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml;q=0.9,*/*;q=0.5' } });
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE = new Set([429, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const RATE_LIMIT_COOLDOWN_MS = 5_000;
const MAX_RETRY_WAIT_MS = 10_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Shopify answers 429 when crawled too fast: wait (honouring Retry-After) and try again before giving up. */
async function fetchPage(fetcher: Fetcher, url: string, baseDelayMs: number) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await timedFetch(fetcher, url);
    if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** attempt;
    await sleep(Math.min(wait, MAX_RETRY_WAIT_MS));
  }
}

export function parseSitemap(xml: string): { sitemaps: string[]; pages: SitemapEntry[] } {
  const decode = (value: string) => value.replace(/&amp;/g, '&').trim();
  const sitemaps = [...xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)]
    .map((match) => /<loc>([\s\S]*?)<\/loc>/i.exec(match[1])?.[1])
    .filter((loc): loc is string => !!loc)
    .map(decode);
  const pages = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].flatMap((match) => {
    const loc = /<loc>([\s\S]*?)<\/loc>/i.exec(match[1])?.[1];
    if (!loc) return [];
    return [{ url: decode(loc), lastModified: /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(match[1])?.[1]?.trim().slice(0, 10) ?? null }];
  });
  return { sitemaps, pages };
}

export async function discoverPages(siteUrl: string, fetcher: Fetcher): Promise<SitemapEntry[]> {
  const host = new URL(siteUrl).host;
  const seen = new Set<string>();
  const found = new Map<string, SitemapEntry>();

  const visit = async (sitemapUrl: string, depth: number): Promise<void> => {
    if (seen.has(sitemapUrl) || depth > MAX_SITEMAP_DEPTH) return;
    seen.add(sitemapUrl);
    try {
      const response = await timedFetch(fetcher, sitemapUrl);
      if (!response.ok) return;
      const { sitemaps, pages } = parseSitemap(await response.text());
      for (const page of pages) {
        try {
          if (new URL(page.url).host === host && !SKIP_EXTENSION.test(page.url)) found.set(page.url, page);
        } catch {
          // Ignore malformed sitemap URLs.
        }
      }
      for (const child of sitemaps) await visit(child, depth + 1);
    } catch (error) {
      logError('SEO audit could not read a sitemap', error, { sitemapUrl });
    }
  };

  await visit(new URL('/sitemap.xml', siteUrl).toString(), 0);
  const home = new URL('/', siteUrl).toString();
  if (!found.has(home)) found.set(home, { url: home, lastModified: null });
  return [...found.values()];
}

async function fetchOptionalText(fetcher: Fetcher, url: string): Promise<{ ok: boolean; text: string; html: boolean }> {
  try {
    const response = await timedFetch(fetcher, url);
    if (!response.ok) return { ok: false, text: '', html: false };
    const text = await response.text();
    const html = (response.headers.get('content-type') ?? '').includes('html') || /^\s*</.test(text);
    return { ok: true, text, html };
  } catch {
    return { ok: false, text: '', html: false };
  }
}

/** Crawls the storefront from its sitemap, scores every page and stores the result. Returns the run id, or null when a run is already active. */
export async function runSeoAudit(db: Queryable, options: AuditOptions = {}): Promise<number | null> {
  const siteUrl = options.siteUrl ?? process.env.SEO_SITE_URL?.trim() ?? DEFAULT_SITE_URL;
  const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const maxPages = options.maxPages ?? (Number(process.env.SEO_AUDIT_MAX_PAGES) || 2000);
  const concurrency = options.concurrency ?? 3;
  const delayMs = options.delayMs ?? 300;
  const deadline = options.deadline ?? Date.now() + 13 * 60_000;

  if (await hasActiveRun(db)) return null;
  const runId = await startRun(db);
  try {
    const [robots, llms, entries] = await Promise.all([
      fetchOptionalText(fetcher, new URL('/robots.txt', siteUrl).toString()),
      fetchOptionalText(fetcher, new URL('/llms.txt', siteUrl).toString()),
      discoverPages(siteUrl, fetcher),
    ]);
    const queue = entries.slice(0, maxPages);
    let hasOrganizationSchema = false;
    let timedOut = false;
    const homeUrl = new URL('/', siteUrl).toString();

    const requeued = new Set<string>();
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        if (Date.now() > deadline) {
          timedOut = true;
          return;
        }
        const pageType = classifyUrl(entry.url);
        const started = Date.now();
        try {
          const response = await fetchPage(fetcher, entry.url, delayMs || 0);
          const responseMs = Date.now() - started;
          const html = response.ok ? await response.text() : '';
          if (response.status === 429 && !requeued.has(entry.url)) {
            // Still rate-limited after retries: cool down and try once more at the end of the queue.
            requeued.add(entry.url);
            queue.push(entry);
            if (delayMs > 0) await sleep(RATE_LIMIT_COOLDOWN_MS);
            continue;
          }
          if (!response.ok || !/<html|<head|<body/i.test(html)) {
            const failed = failedPageScores(response.status, response.ok ? 'Response was not an HTML page' : `HTTP ${response.status}`);
            await upsertPage(db, runId, { url: entry.url, pageType, statusCode: response.status, responseMs, title: null, metaDescription: null, h1: null, canonical: null, wordCount: null, schemaTypes: [], lastModified: entry.lastModified, ...failed });
            continue;
          }
          const signals = extractSignals(html, entry.url);
          if (entry.url === homeUrl) hasOrganizationSchema = ['Organization', 'LocalBusiness', 'Store'].some((type) => signals.schemaTypes.includes(type));
          const lastModified = (signals.dateModified ?? entry.lastModified)?.slice(0, 10) ?? null;
          const scores = scorePage(signals, pageType, { statusCode: response.status, lastModified });
          await upsertPage(db, runId, {
            url: entry.url, pageType, statusCode: response.status, responseMs, title: signals.title, metaDescription: signals.metaDescription,
            h1: signals.h1s[0] ?? null, canonical: signals.canonical, wordCount: signals.wordCount, schemaTypes: signals.schemaTypes, lastModified, ...scores,
          });
        } catch (error) {
          const failed = failedPageScores(0, error instanceof Error ? error.message : 'Fetch failed');
          await upsertPage(db, runId, { url: entry.url, pageType, statusCode: null, responseMs: null, title: null, metaDescription: null, h1: null, canonical: null, wordCount: null, schemaTypes: [], lastModified: entry.lastModified, ...failed });
        }
        if (delayMs > 0) await sleep(delayMs);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));

    const siteChecks = buildSiteChecks({
      robots: robots.ok && !robots.html ? robots.text : null,
      llmsTxt: llms.ok && !llms.html,
      sitemapPages: entries.length,
      hasOrganizationSchema,
    });
    await finishRun(db, runId, { status: timedOut || entries.length > maxPages ? 'partial' : 'completed', siteChecks });
    logInfo('SEO audit finished', { runId, pages: entries.length });
  } catch (error) {
    logError('SEO audit failed', error, { runId });
    await finishRun(db, runId, { status: 'failed', siteChecks: [], error: error instanceof Error ? error.message.slice(0, 500) : 'Audit failed' }).catch(() => undefined);
    throw error;
  }
  return runId;
}
