import type { Queryable } from '../../db/sellersSummary.js';
import { getPostgresPool } from '../../db/pool.js';
import { runCitationCheck } from '../../seo/citations.js';
import { runSeoAudit } from '../../seo/crawl.js';
import { runPageSpeedSample } from '../../seo/pagespeed.js';
import { getOptionalSecret } from '../../shared/secrets.js';

export type SeoTaskEvent = { task?: 'audit' | 'citations'; runId?: number };

/** The crawl, then a PageSpeed sample of a few pages (its own time budget, never fails the audit). */
export async function runAuditWithPageSpeed(db: Queryable): Promise<number | null> {
  const runId = await runSeoAudit(db);
  if (runId !== null) await runPageSpeedSample(db, { apiKey: getOptionalSecret('PAGESPEED_API_KEY') });
  return runId;
}

/** Scheduled weekly (audit) and invoked on demand by startAudit for either task. */
export async function handler(event: SeoTaskEvent = {}): Promise<{ runId: number | null }> {
  const pool = getPostgresPool();
  if (event?.task === 'citations' && typeof event.runId === 'number') {
    await runCitationCheck(pool, event.runId);
    return { runId: event.runId };
  }
  return { runId: await runAuditWithPageSpeed(pool) };
}
