import { getPostgresPool } from '../../db/pool.js';
import { runSeoAudit } from '../../seo/crawl.js';

/** Scheduled weekly and invoked on demand by startAudit; both run the same full crawl. */
export async function handler(): Promise<{ runId: number | null }> {
  return { runId: await runSeoAudit(getPostgresPool()) };
}
