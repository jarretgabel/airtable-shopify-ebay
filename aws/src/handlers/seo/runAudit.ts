import type { Queryable } from '../../db/sellersSummary.js';
import { getPostgresPool } from '../../db/pool.js';
import { runCitationCheck } from '../../seo/citations.js';
import { runSeoAudit } from '../../seo/crawl.js';
import { runPageSpeedSample } from '../../seo/pagespeed.js';
import { getOptionalSecret } from '../../shared/secrets.js';
import { DEFAULT_SEO_SITE, parseSeoSite, type SeoSiteId } from '../../seo/sites.js';

export type SeoTaskEvent = { task?: 'audit' | 'citations'; runId?: number; site?: SeoSiteId };

/** The crawl, then a PageSpeed sample of a few pages (its own time budget, never fails the audit). */
export async function runAuditWithPageSpeed(db: Queryable, existingRunId?: number, site: SeoSiteId = DEFAULT_SEO_SITE): Promise<number | null> {
  const runId = await runSeoAudit(db, { runId: existingRunId, site });
  if (runId !== null) await runPageSpeedSample(db, { apiKey: getOptionalSecret('PAGESPEED_API_KEY'), site });
  return runId;
}

/** Scheduled weekly (audit) and invoked on demand by startAudit for either task. */
export async function handler(event: SeoTaskEvent = {}): Promise<{ runId: number | null }> {
  const pool = getPostgresPool();
  if (event?.task === 'citations' && typeof event.runId === 'number') {
    await runCitationCheck(pool, event.runId, { site: parseSeoSite(event.site) });
    return { runId: event.runId };
  }
  return { runId: await runAuditWithPageSpeed(pool, typeof event?.runId === 'number' ? event.runId : undefined, parseSeoSite(event?.site)) };
}
