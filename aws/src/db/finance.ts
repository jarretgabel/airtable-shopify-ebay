import type { Queryable } from './sellersSummary.js';

export interface FinanceSummary {
  costOnHand: { items: number; cost: number };
  sold: { items: number; cost: number };
  earnings: { itemsWithSalePrice: number; revenue: number; cost: number; profit: number; marginPct: number | null };
  soldWithoutSalePrice: number;
}

const SOLD_STATUSES = ['Shipped', 'Sold - Ready to Ship'];
const OFF_BOOKS_STATUSES = ['Pending Review', 'Unqualified'];

// Read-only. Cost is the intake Cost field. Sale price is recorded by the sale webhooks, so earnings only
// cover items sold after that started; older sold items count as "without sale price".
export async function getFinanceSummary(db: Queryable): Promise<FinanceSummary> {
  const result = await db.query(
    `SELECT
       count(*) FILTER (WHERE NOT (i.workflow_status = ANY($1) OR i.workflow_status = ANY($2) OR i.workflow_status IS NULL))::int AS hand_items,
       coalesce(sum(i.cost) FILTER (WHERE NOT (i.workflow_status = ANY($1) OR i.workflow_status = ANY($2) OR i.workflow_status IS NULL)), 0)::float AS hand_cost,
       count(*) FILTER (WHERE i.workflow_status = ANY($1))::int AS sold_items,
       coalesce(sum(i.cost) FILTER (WHERE i.workflow_status = ANY($1)), 0)::float AS sold_cost,
       count(*) FILTER (WHERE i.workflow_status = ANY($1) AND s.price IS NOT NULL)::int AS priced_items,
       coalesce(sum(s.price) FILTER (WHERE i.workflow_status = ANY($1)), 0)::float AS revenue,
       coalesce(sum(i.cost) FILTER (WHERE i.workflow_status = ANY($1) AND s.price IS NOT NULL), 0)::float AS priced_cost
     FROM items i
     LEFT JOIN LATERAL (
       SELECT CASE WHEN r.fields->>'Sale Price' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (r.fields->>'Sale Price')::numeric END AS price
       FROM records r WHERE r.record_id = i.airtable_record_id AND r.deleted_at IS NULL LIMIT 1
     ) s ON true
     WHERE i.deleted_at IS NULL`,
    [SOLD_STATUSES, OFF_BOOKS_STATUSES],
  );
  const row = result.rows[0] ?? {};
  const revenue = Number(row.revenue ?? 0);
  const pricedCost = Number(row.priced_cost ?? 0);
  const pricedItems = Number(row.priced_items ?? 0);
  const soldItems = Number(row.sold_items ?? 0);

  return {
    costOnHand: { items: Number(row.hand_items ?? 0), cost: Number(row.hand_cost ?? 0) },
    sold: { items: soldItems, cost: Number(row.sold_cost ?? 0) },
    earnings: {
      itemsWithSalePrice: pricedItems,
      revenue,
      cost: pricedCost,
      profit: revenue - pricedCost,
      marginPct: revenue > 0 ? Math.round(((revenue - pricedCost) / revenue) * 100) : null,
    },
    soldWithoutSalePrice: soldItems - pricedItems,
  };
}
