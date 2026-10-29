export interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface SellerRow {
  email: string;
  location: string | null;
  mailingListOptIn: boolean;
  itemCount: number;
  lastItemDate: string | null;
}

export interface SellersSummary {
  totals: { contacts: number; sellersWithItems: number; repeatSellers: number; mailingListOptIns: number };
  topSellers: SellerRow[];
}

export const SELLERS_SUMMARY_MAX_ROWS = 25;

// Read-only: reads the normalized tables built from the Airtable mirror.
// Seller intake rows have no Arrival Date, so the record's created date stands in for the last arrival.
export async function getSellersSummary(
  db: Queryable,
  limit = 10,
  filters: { search?: string | null; from?: string | null; to?: string | null } = {},
): Promise<SellersSummary> {
  const rowLimit = Math.min(Math.max(Math.trunc(limit) || 10, 1), SELLERS_SUMMARY_MAX_ROWS);

  const search = filters.search?.trim();
  const searchPattern = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;

  const totals = await db.query(
    `WITH per_contact AS (
       SELECT c.id, c.mailing_list_opt_in, count(i.id) AS item_count
       FROM contacts c
       LEFT JOIN items i ON i.seller_contact_id = c.id AND i.deleted_at IS NULL
       GROUP BY c.id
     )
     SELECT count(*)::int AS contacts,
            count(*) FILTER (WHERE item_count > 0)::int AS sellers_with_items,
            count(*) FILTER (WHERE item_count > 1)::int AS repeat_sellers,
            count(*) FILTER (WHERE mailing_list_opt_in)::int AS mailing_list_opt_ins
     FROM per_contact`,
  );

  const top = await db.query(
    `SELECT c.email, c.location, c.mailing_list_opt_in, count(i.id)::int AS item_count,
            max(coalesce(i.arrival_date, i.airtable_created_at::date))::text AS last_item_date
     FROM contacts c
     LEFT JOIN items i ON i.seller_contact_id = c.id AND i.deleted_at IS NULL
     WHERE ($2::text IS NULL OR c.email ILIKE $2 OR c.name ILIKE $2 OR c.location ILIKE $2)
     GROUP BY c.id
     HAVING ($3::date IS NULL OR max(coalesce(i.arrival_date, i.airtable_created_at::date)) >= $3::date)
        AND ($4::date IS NULL OR max(coalesce(i.arrival_date, i.airtable_created_at::date)) <= $4::date)
     ORDER BY item_count DESC, max(coalesce(i.arrival_date, i.airtable_created_at::date)) DESC NULLS LAST, c.email
     LIMIT $1`,
    [rowLimit, searchPattern, filters.from || null, filters.to || null],
  );

  const t = totals.rows[0] ?? {};
  return {
    totals: {
      contacts: Number(t.contacts ?? 0),
      sellersWithItems: Number(t.sellers_with_items ?? 0),
      repeatSellers: Number(t.repeat_sellers ?? 0),
      mailingListOptIns: Number(t.mailing_list_opt_ins ?? 0),
    },
    topSellers: top.rows.map((row) => ({
      email: String(row.email),
      location: (row.location as string | null) ?? null,
      mailingListOptIn: row.mailing_list_opt_in === true,
      itemCount: Number(row.item_count),
      lastItemDate: (row.last_item_date as string | null) ?? null,
    })),
  };
}
