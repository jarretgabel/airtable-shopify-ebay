import type { Queryable } from './sellersSummary.js';

export interface ReportsSummary {
  inventoryByStatus: Array<{ status: string; count: number }>;
  timeInStage: Array<{ status: string; avgDays: number; stints: number }>;
  shippedByBrand: Array<{ brand: string; count: number; totalCost: number }>;
}

const TOP_BRANDS = 15;

// Read-only reports over the normalized tables. Time in stage only covers stints that have ended,
// so an item still sitting in its current status is not counted.
export async function getReportsSummary(db: Queryable): Promise<ReportsSummary> {
  const inventory = await db.query(
    `SELECT coalesce(workflow_status, 'No status') AS status, count(*)::int AS count
     FROM items WHERE deleted_at IS NULL
     GROUP BY 1 ORDER BY count DESC, status`,
  );

  const stages = await db.query(
    `WITH stints AS (
       SELECT status, lead(changed_at) OVER (PARTITION BY item_id ORDER BY changed_at, id) - changed_at AS spent
       FROM item_status_history
     )
     SELECT status, round((avg(extract(epoch FROM spent)) / 86400)::numeric, 1)::float AS avg_days, count(*)::int AS stints
     FROM stints WHERE spent IS NOT NULL
     GROUP BY status ORDER BY avg_days DESC, status`,
  );

  const brands = await db.query(
    `SELECT coalesce(nullif(trim(make), ''), 'Unknown') AS brand, count(*)::int AS count, coalesce(sum(cost), 0)::float AS total_cost
     FROM items WHERE deleted_at IS NULL AND workflow_status = 'Shipped'
     GROUP BY 1 ORDER BY count DESC, brand LIMIT $1`,
    [TOP_BRANDS],
  );

  return {
    inventoryByStatus: inventory.rows.map((r) => ({ status: String(r.status), count: Number(r.count) })),
    timeInStage: stages.rows.map((r) => ({ status: String(r.status), avgDays: Number(r.avg_days), stints: Number(r.stints) })),
    shippedByBrand: brands.rows.map((r) => ({ brand: String(r.brand), count: Number(r.count), totalCost: Number(r.total_cost) })),
  };
}
