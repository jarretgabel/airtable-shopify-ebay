import type { Queryable } from './sellersSummary.js';

export const INTERACTION_KINDS = ['email', 'call', 'text', 'visit', 'note', 'other'] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export interface ContactListRow {
  id: string;
  email: string;
  name: string | null;
  location: string | null;
  itemCount: number;
  openFollowUps: number;
}

export interface ContactDetail {
  contact: { id: string; email: string; name: string | null; phone: string | null; location: string | null; mailingListOptIn: boolean };
  items: Array<{ recordId: string | null; sku: string | null; make: string | null; model: string | null; status: string | null }>;
  interactions: Array<{ id: string; kind: InteractionKind; occurredAt: string; summary: string | null; createdBy: string | null }>;
  followUps: Array<{ id: string; dueAt: string; status: string; note: string | null }>;
}

export interface DueFollowUp {
  id: string;
  contactId: string;
  contactEmail: string;
  dueAt: string;
  note: string | null;
}

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();
const text = (value: unknown): string | null => (value == null ? null : String(value));

export async function listContacts(db: Queryable, search = '', limit = 50): Promise<ContactListRow[]> {
  const rowLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  const pattern = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
  const result = await db.query(
    `SELECT c.id, c.email, c.name, c.location,
            (SELECT count(*)::int FROM items i WHERE i.seller_contact_id = c.id AND i.deleted_at IS NULL) AS item_count,
            (SELECT count(*)::int FROM follow_ups f WHERE f.contact_id = c.id AND f.status = 'open') AS open_follow_ups
     FROM contacts c
     WHERE c.email ILIKE $1 OR c.name ILIKE $1 OR c.phone ILIKE $1
     ORDER BY open_follow_ups DESC, item_count DESC, c.email
     LIMIT $2`,
    [pattern, rowLimit],
  );
  return result.rows.map((r) => ({
    id: String(r.id), email: String(r.email), name: text(r.name), location: text(r.location),
    itemCount: Number(r.item_count), openFollowUps: Number(r.open_follow_ups),
  }));
}

export async function getContactDetail(db: Queryable, contactId: string): Promise<ContactDetail | null> {
  const contact = await db.query(
    `SELECT id, email, name, phone, location, mailing_list_opt_in FROM contacts WHERE id = $1`, [contactId],
  );
  const c = contact.rows[0];
  if (!c) return null;
  const items = await db.query(
    `SELECT airtable_record_id, sku, make, model, workflow_status FROM items
     WHERE seller_contact_id = $1 AND deleted_at IS NULL ORDER BY airtable_created_at DESC NULLS LAST LIMIT 100`, [contactId],
  );
  const interactions = await db.query(
    `SELECT id, kind, occurred_at, summary, created_by FROM interactions WHERE contact_id = $1 ORDER BY occurred_at DESC LIMIT 100`, [contactId],
  );
  const followUps = await db.query(
    `SELECT id, due_at, status, note FROM follow_ups WHERE contact_id = $1 ORDER BY (status = 'open') DESC, due_at DESC LIMIT 100`, [contactId],
  );
  return {
    contact: { id: String(c.id), email: String(c.email), name: text(c.name), phone: text(c.phone), location: text(c.location), mailingListOptIn: c.mailing_list_opt_in === true },
    items: items.rows.map((r) => ({ recordId: text(r.airtable_record_id), sku: text(r.sku), make: text(r.make), model: text(r.model), status: text(r.workflow_status) })),
    interactions: interactions.rows.map((r) => ({ id: String(r.id), kind: r.kind as InteractionKind, occurredAt: iso(r.occurred_at), summary: text(r.summary), createdBy: text(r.created_by) })),
    followUps: followUps.rows.map((r) => ({ id: String(r.id), dueAt: iso(r.due_at), status: String(r.status), note: text(r.note) })),
  };
}

export async function addInteraction(db: Queryable, contactId: string, kind: InteractionKind, summary: string, createdBy: string): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO interactions (contact_id, kind, summary, created_by)
     SELECT id, $2, $3, $4 FROM contacts WHERE id = $1 RETURNING id`,
    [contactId, kind, summary, createdBy],
  );
  return result.rows.length > 0;
}

export async function addFollowUp(db: Queryable, contactId: string, dueAt: string, note: string, createdBy: string): Promise<boolean> {
  const result = await db.query(
    `INSERT INTO follow_ups (contact_id, due_at, note, created_by)
     SELECT id, $2::timestamptz, $3, $4 FROM contacts WHERE id = $1 RETURNING id`,
    [contactId, dueAt, note, createdBy],
  );
  return result.rows.length > 0;
}

/** Only open follow-ups can be closed; returns false when the id is unknown or already closed. */
export async function closeFollowUp(db: Queryable, followUpId: string, status: 'done' | 'cancelled'): Promise<boolean> {
  const result = await db.query(
    `UPDATE follow_ups SET status = $2, completed_at = now() WHERE id = $1 AND status = 'open' RETURNING id`,
    [followUpId, status],
  );
  return result.rows.length > 0;
}

export async function listDueFollowUps(db: Queryable, limit = 50): Promise<DueFollowUp[]> {
  const result = await db.query(
    `SELECT f.id, f.contact_id, c.email, f.due_at, f.note
     FROM follow_ups f JOIN contacts c ON c.id = f.contact_id
     WHERE f.status = 'open' AND f.due_at <= now()
     ORDER BY f.due_at LIMIT $1`,
    [Math.min(Math.max(Math.trunc(limit) || 50, 1), 200)],
  );
  return result.rows.map((r) => ({ id: String(r.id), contactId: String(r.contact_id), contactEmail: String(r.email), dueAt: iso(r.due_at), note: text(r.note) }));
}
