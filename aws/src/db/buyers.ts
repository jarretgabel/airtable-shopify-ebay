import type { Queryable } from './sellersSummary.js';

export interface BuyerItem {
  recordId: string;
  sku: string | null;
  title: string | null;
  price: number | null;
  soldAt: string | null;
  soldVia: string | null;
  order: string | null;
}

export interface BuyerRow {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  shipTo: string | null;
  itemCount: number;
  totalSpent: number;
  lastPurchase: string | null;
  items: BuyerItem[];
}

export interface BuyersSummary {
  totals: { buyers: number; items: number; revenue: number };
  buyers: BuyerRow[];
}

export const BUYERS_MAX_ROWS = 100;

// Read-only. Buyers are grouped from the buyer fields the sale webhooks write on each listing:
// by email, or by name when the email is missing or masked.
export async function getBuyersSummary(
  db: Queryable,
  filters: { search?: string | null; from?: string | null; to?: string | null; limit?: number } = {},
): Promise<BuyersSummary> {
  const limit = Math.min(Math.max(Math.trunc(filters.limit ?? 50) || 50, 1), BUYERS_MAX_ROWS);
  const search = filters.search?.trim();
  const pattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;

  const result = await db.query(
    `WITH sales AS (
       SELECT r.record_id,
              nullif(trim(r.fields->>'Buyer Name'), '') AS name,
              nullif(trim(r.fields->>'Buyer Email'), '') AS email,
              nullif(trim(r.fields->>'Buyer Phone'), '') AS phone,
              nullif(trim(r.fields->>'Buyer Ship To'), '') AS ship_to,
              nullif(trim(r.fields->>'Sale Order'), '') AS sale_order,
              nullif(trim(r.fields->>'Sold Via'), '') AS sold_via,
              nullif(trim(r.fields->'SKU'->>'text'), '') AS sku,
              nullif(trim(concat_ws(' ', r.fields->>'Make', r.fields->>'Model')), '') AS title,
              CASE WHEN r.fields->>'Sale Price' ~ '^[0-9]+(\\.[0-9]+)?$' THEN (r.fields->>'Sale Price')::numeric END AS price,
              CASE WHEN r.fields->>'Sold At' ~ '^\\d{4}-\\d{2}-\\d{2}' THEN substr(r.fields->>'Sold At', 1, 10)::date END AS sold_at
       FROM records r
       WHERE r.deleted_at IS NULL
         AND (r.fields ? 'Buyer Name' OR r.fields ? 'Buyer Email')
     ), keyed AS (
       SELECT *, lower(coalesce(email, name)) AS buyer_key FROM sales WHERE coalesce(email, name) IS NOT NULL
     ), filtered AS (
       SELECT * FROM keyed
       WHERE ($1::text IS NULL OR name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1 OR sku ILIKE $1 OR sale_order ILIKE $1)
         AND ($2::date IS NULL OR sold_at >= $2::date)
         AND ($3::date IS NULL OR sold_at <= $3::date)
     )
     SELECT buyer_key,
            (array_agg(name ORDER BY sold_at DESC NULLS LAST) FILTER (WHERE name IS NOT NULL))[1] AS name,
            (array_agg(email ORDER BY sold_at DESC NULLS LAST) FILTER (WHERE email IS NOT NULL))[1] AS email,
            (array_agg(phone ORDER BY sold_at DESC NULLS LAST) FILTER (WHERE phone IS NOT NULL))[1] AS phone,
            (array_agg(ship_to ORDER BY sold_at DESC NULLS LAST) FILTER (WHERE ship_to IS NOT NULL))[1] AS ship_to,
            count(*)::int AS item_count,
            coalesce(sum(price), 0)::float AS total_spent,
            max(sold_at)::text AS last_purchase,
            json_agg(json_build_object('recordId', record_id, 'sku', sku, 'title', title, 'price', price,
                                       'soldAt', sold_at, 'soldVia', sold_via, 'order', sale_order)
                     ORDER BY sold_at DESC NULLS LAST) AS items
     FROM filtered
     GROUP BY buyer_key
     ORDER BY max(sold_at) DESC NULLS LAST, buyer_key
     LIMIT $4`,
    [pattern, filters.from || null, filters.to || null, limit],
  );

  const buyers = result.rows.map((row): BuyerRow => ({
    key: String(row.buyer_key),
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    shipTo: (row.ship_to as string | null) ?? null,
    itemCount: Number(row.item_count),
    totalSpent: Number(row.total_spent),
    lastPurchase: (row.last_purchase as string | null) ?? null,
    items: ((row.items as BuyerItem[] | null) ?? []).map((item) => ({
      recordId: item.recordId,
      sku: item.sku ?? null,
      title: item.title ?? null,
      price: item.price === null || item.price === undefined ? null : Number(item.price),
      soldAt: item.soldAt ?? null,
      soldVia: item.soldVia ?? null,
      order: item.order ?? null,
    })),
  }));

  return {
    totals: {
      buyers: buyers.length,
      items: buyers.reduce((sum, buyer) => sum + buyer.itemCount, 0),
      revenue: buyers.reduce((sum, buyer) => sum + buyer.totalSpent, 0),
    },
    buyers,
  };
}
