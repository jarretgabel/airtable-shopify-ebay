import type { Queryable } from './sellersSummary.js';

export interface SellerHistory {
  contact: {
    email: string;
    alternateEmails: string[];
    name: string | null;
    phone: string | null;
    location: string | null;
    mailingListOptIn: boolean;
  };
  totals: { items: number; paidAmount: number; refundAmount: number };
  items: Array<{
    airtableRecordId: string;
    sku: string | null;
    make: string | null;
    model: string | null;
    workflowStatus: string | null;
    arrivalDate: string | null;
    paidAmount: number | null;
    postSaleOutcome: string | null;
  }>;
  interactions: Array<{ kind: string; occurredAt: string; summary: string | null }>;
  openFollowUps: Array<{ dueAt: string; note: string | null }>;
  openInquiries: number;
}

export const SELLER_HISTORY_MAX_ITEMS = 200;
const RELATED_LIMIT = 50;

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

// Read-only. Matches the primary or an alternate (merged) email, case-insensitively. Returns null when no contact matches.
export async function getSellerHistory(db: Queryable, email: string): Promise<SellerHistory | null> {
  const needle = email.trim().toLowerCase();
  if (!needle) return null;

  const contactResult = await db.query(
    `SELECT id, email, alternate_emails, name, phone, location, mailing_list_opt_in
     FROM contacts WHERE lower(email) = $1 OR $1 = ANY (SELECT lower(a) FROM unnest(alternate_emails) AS a) LIMIT 1`,
    [needle],
  );
  const contact = contactResult.rows[0];
  if (!contact) return null;

  const items = await db.query(
    `SELECT airtable_record_id, sku, make, model, workflow_status, arrival_date::text AS arrival_date, paid_amount, post_sale_outcome,
            refund_amount
     FROM items WHERE seller_contact_id = $1 AND deleted_at IS NULL
     ORDER BY coalesce(arrival_date, airtable_created_at::date) DESC NULLS LAST, airtable_record_id
     LIMIT $2`,
    [contact.id, SELLER_HISTORY_MAX_ITEMS],
  );
  const totals = await db.query(
    `SELECT count(*)::int AS items, coalesce(sum(paid_amount), 0) AS paid, coalesce(sum(refund_amount), 0) AS refunded
     FROM items WHERE seller_contact_id = $1 AND deleted_at IS NULL`,
    [contact.id],
  );
  const interactions = await db.query(
    'SELECT kind, occurred_at::text AS occurred_at, summary FROM interactions WHERE contact_id = $1 ORDER BY occurred_at DESC LIMIT $2',
    [contact.id, RELATED_LIMIT],
  );
  const followUps = await db.query(
    `SELECT due_at::text AS due_at, note FROM follow_ups WHERE contact_id = $1 AND status = 'open' ORDER BY due_at LIMIT $2`,
    [contact.id, RELATED_LIMIT],
  );
  const inquiries = await db.query(
    `SELECT count(*)::int AS open FROM inquiries WHERE contact_id = $1 AND status = 'open'`,
    [contact.id],
  );

  const t = totals.rows[0] ?? {};
  return {
    contact: {
      email: String(contact.email),
      alternateEmails: (contact.alternate_emails as string[] | null) ?? [],
      name: (contact.name as string | null) ?? null,
      phone: (contact.phone as string | null) ?? null,
      location: (contact.location as string | null) ?? null,
      mailingListOptIn: Boolean(contact.mailing_list_opt_in),
    },
    totals: { items: Number(t.items ?? 0), paidAmount: Number(t.paid ?? 0), refundAmount: Number(t.refunded ?? 0) },
    items: items.rows.map((row) => ({
      airtableRecordId: String(row.airtable_record_id),
      sku: (row.sku as string | null) ?? null,
      make: (row.make as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      workflowStatus: (row.workflow_status as string | null) ?? null,
      arrivalDate: (row.arrival_date as string | null) ?? null,
      paidAmount: num(row.paid_amount),
      postSaleOutcome: (row.post_sale_outcome as string | null) ?? null,
    })),
    interactions: interactions.rows.map((row) => ({
      kind: String(row.kind),
      occurredAt: String(row.occurred_at),
      summary: (row.summary as string | null) ?? null,
    })),
    openFollowUps: followUps.rows.map((row) => ({ dueAt: String(row.due_at), note: (row.note as string | null) ?? null })),
    openInquiries: Number(inquiries.rows[0]?.open ?? 0),
  };
}
