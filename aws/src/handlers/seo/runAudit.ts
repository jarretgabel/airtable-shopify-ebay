import type { Queryable } from '../../db/sellersSummary.js';
import { getPostgresPool } from '../../db/pool.js';
import { hasActiveCitationRun, runCitationCheck, startCitationRun } from '../../seo/citations.js';
import { runSeoAudit } from '../../seo/crawl.js';
import { runPageSpeedSample } from '../../seo/pagespeed.js';
import { getOptionalSecret } from '../../shared/secrets.js';
import { DEFAULT_SEO_SITE, parseSeoSite, SEO_SITE_IDS, type SeoSiteId } from '../../seo/sites.js';
import { syncSearchConsole } from '../../seo/searchConsole.js';

export type SeoTaskEvent = { task?: 'audit' | 'citations' | 'search-console'; runId?: number; site?: SeoSiteId };

/** The crawl, then a PageSpeed sample of a few pages (its own time budget, never fails the audit). */
export async function runAuditWithPageSpeed(db: Queryable, existingRunId?: number, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<number | null> {
  const runId = await runSeoAudit(db, { runId: existingRunId, site });
  if (runId !== null) await runPageSpeedSample(db, { apiKey: getOptionalSecret('PAGESPEED_API_KEY'), site });
  await syncSearchConsole(db, site);
  return runId;
}

/** Scheduled nightly (audit and AI citations) and invoked on demand by startAudit for either task. */
export async function handler(event: SeoTaskEvent = {}): Promise<{ runId: number | null }> {
  const pool = getPostgresPool();
  if (event?.task === 'search-console') {
    for (const site of event.site ? [parseSeoSite(event.site)] : SEO_SITE_IDS) await syncSearchConsole(pool, site);
    return { runId: null };
  }
  if (event?.task === 'citations') {
    const site = parseSeoSite(event.site);
    // Scheduled runs carry no runId, so create the run row here unless one is already in progress.
    let runId = typeof event.runId === 'number' ? event.runId : null;
    if (runId === null) {
      if (await hasActiveCitationRun(pool, site)) return { runId: null };
      runId = await startCitationRun(pool, site);
    }
    await runCitationCheck(pool, runId, { site });
    return { runId };
  }
  return { runId: await runAuditWithPageSpeed(pool, typeof event?.runId === 'number' ? event.runId : undefined, parseSeoSite(event?.site)) };
}
