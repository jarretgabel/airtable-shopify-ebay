import type { Client } from 'pg';
import { normalizeListing, phoneKey, type ContactRow } from './normalize.js';

export interface MirrorRecord {
  recordId: string;
  fields: Record<string, unknown>;
  airtableCreatedAt: string | null;
  deletedAt: string | null;
}

export interface NormalizeReport {
  records: number;
  contacts: number;
  items: number;
  listings: number;
  statusHistory: number;
  images: number;
  recordsWithoutEmail: number;
}

export interface MergedContact extends ContactRow {
  alternateEmails: string[];
}

export interface MergeResult {
  contacts: MergedContact[];
  // Every email seen (primary or alternate) -> its contact's primary email.
  primaryByEmail: Map<string, string>;
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

// Same person, different address: identical local part (aol vs gmail) or a typo within two edits.
function looksLikeSamePerson(a: string, b: string): boolean {
  return a.split('@')[0] === b.split('@')[0] || editDistance(a, b) <= 2;
}

// Rows must be oldest first. Matching: same email, or a new email that shares a 10-digit phone with an existing
// contact AND looks like the same address (typo or alias). A phone shared by unrelated emails (household) never merges.
// Later records win per field and opt-in is sticky. The primary email is the most frequently seen one (newest on ties).
export function mergeContacts(rows: ContactRow[]): MergeResult {
  interface Group { rows: ContactRow[]; emailCounts: Map<string, number>; emailLast: Map<string, number>; phones: Set<string> }
  const groups: Group[] = [];
  const groupByEmail = new Map<string, Group>();
  const groupsByPhone = new Map<string, Set<Group>>();

  rows.forEach((row, index) => {
    let group = groupByEmail.get(row.email);
    const phone = phoneKey(row.phone);
    if (!group && phone) {
      group = [...(groupsByPhone.get(phone) ?? [])].find((candidate) =>
        [...candidate.emailCounts.keys()].some((email) => looksLikeSamePerson(email, row.email)));
    }
    if (!group) {
      group = { rows: [], emailCounts: new Map(), emailLast: new Map(), phones: new Set() };
      groups.push(group);
    }
    group.rows.push(row);
    group.emailCounts.set(row.email, (group.emailCounts.get(row.email) ?? 0) + 1);
    group.emailLast.set(row.email, index);
    groupByEmail.set(row.email, group);
    if (phone) {
      group.phones.add(phone);
      const set = groupsByPhone.get(phone) ?? new Set<Group>();
      set.add(group);
      groupsByPhone.set(phone, set);
    }
  });

  const contacts: MergedContact[] = [];
  const primaryByEmail = new Map<string, string>();
  for (const group of groups) {
    const emails = [...group.emailCounts.keys()].sort(
      (a, b) => group.emailCounts.get(b)! - group.emailCounts.get(a)! || group.emailLast.get(b)! - group.emailLast.get(a)!,
    );
    const merged = group.rows.reduce<ContactRow>((acc, row) => ({
      email: emails[0],
      phone: row.phone ?? acc.phone,
      zipCode: row.zipCode ?? acc.zipCode,
      location: row.location ?? acc.location,
      howDidYouHear: row.howDidYouHear ?? acc.howDidYouHear,
      mailingListOptIn: acc.mailingListOptIn || row.mailingListOptIn,
    }), { ...group.rows[0], email: emails[0], mailingListOptIn: false });
    contacts.push({ ...merged, alternateEmails: emails.slice(1) });
    for (const email of emails) primaryByEmail.set(email, emails[0]);
  }
  return { contacts, primaryByEmail };
}

export async function readMirrorListings(client: Client, baseId: string, tableId: string): Promise<MirrorRecord[]> {
  const result = await client.query(
    `SELECT record_id, fields, airtable_created_at, deleted_at FROM records
     WHERE base_id = $1 AND table_id = $2
     ORDER BY airtable_created_at NULLS FIRST, record_id`,
    [baseId, tableId],
  );
  return result.rows.map((row) => ({
    recordId: row.record_id,
    fields: row.fields,
    airtableCreatedAt: row.airtable_created_at ? new Date(row.airtable_created_at).toISOString() : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
  }));
}

const ROWS_PER_STATEMENT = 400;

// One multi-row statement per chunk instead of one query per row (the per-row version took ~17 min over the network).
async function bulkWrite(
  client: Client,
  table: string,
  columns: string[],
  rows: unknown[][],
  options: { casts?: Record<string, string>; conflict?: string; returning?: string } = {},
): Promise<Array<Record<string, string>>> {
  const returned: Array<Record<string, string>> = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(start, start + ROWS_PER_STATEMENT);
    const values: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = row.map((value, column) => {
        values.push(value);
        const cast = options.casts?.[columns[column]];
        return `$${values.length}${cast ? `::${cast}` : ''}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const result = await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')} ${options.conflict ?? ''} ${options.returning ? `RETURNING ${options.returning}` : ''}`,
      values,
    );
    returned.push(...result.rows);
  }
  return returned;
}

const CONTACT_COLUMNS = ['email', 'alternate_emails', 'phone', 'zip_code', 'location', 'mailing_list_opt_in', 'how_did_you_hear'];
const ITEM_COLUMNS = [
  'airtable_record_id', 'sku', 'make', 'model', 'serial_number', 'component_type', 'condition', 'cost', 'offer_amount',
  'paid_amount', 'arrival_date', 'workflow_status', 'workflow_source', 'jotform_submission_id', 'seller_contact_id',
  'vendor', 'shopify_order_id', 'shopify_order_name', 'post_sale_outcome', 'post_sale_outcome_at', 'refund_amount',
  'refund_reason', 'return_received_at', 'restock_disposition', 'airtable_created_at', 'deleted_at',
];

const upsertSet = (columns: string[], keep: string[]) =>
  columns.filter((column) => !keep.includes(column)).map((column) => `${column} = EXCLUDED.${column}`).join(', ');

// Idempotent and rebuildable: reads only from the mirror and writes only to the normalized tables, in one transaction.
export async function normalizeListings(client: Client, records: MirrorRecord[]): Promise<NormalizeReport> {
  const mapped = records.map((record) => ({ record, normalized: normalizeListing(record.fields) }));
  const report: NormalizeReport = {
    records: records.length,
    contacts: 0,
    items: 0,
    listings: 0,
    statusHistory: 0,
    images: 0,
    recordsWithoutEmail: mapped.filter((entry) => !entry.normalized.contact).length,
  };

  await client.query('BEGIN');
  try {
    const { contacts, primaryByEmail } = mergeContacts(
      mapped.flatMap((entry) => (entry.normalized.contact ? [entry.normalized.contact] : [])),
    );
    const contactRows = await bulkWrite(
      client,
      'contacts',
      CONTACT_COLUMNS,
      contacts.map((c) => [c.email, c.alternateEmails, c.phone, c.zipCode, c.location, c.mailingListOptIn, c.howDidYouHear]),
      {
        conflict: `ON CONFLICT (email) DO UPDATE SET ${upsertSet(CONTACT_COLUMNS, ['email'])}, updated_at = now()`,
        returning: 'id, email',
      },
    );
    const contactIds = new Map<string, string>(contactRows.map((row) => [row.email, row.id]));
    report.contacts = contacts.length;

    const itemRows = await bulkWrite(
      client,
      'items',
      ITEM_COLUMNS,
      mapped.map(({ record, normalized }) => {
        const item = normalized.item;
        const primary = normalized.contact ? primaryByEmail.get(normalized.contact.email) : undefined;
        return [
          record.recordId, item.sku, item.make, item.model, item.serialNumber, item.componentType, item.condition,
          item.cost, item.offerAmount, item.paidAmount, item.arrivalDate, item.workflowStatus, item.workflowSource,
          item.jotformSubmissionId, primary ? contactIds.get(primary) ?? null : null, item.vendor, item.shopifyOrderId,
          item.shopifyOrderName, item.postSaleOutcome, item.postSaleOutcomeAt, item.refundAmount, item.refundReason,
          item.returnReceivedAt, item.restockDisposition, record.airtableCreatedAt, record.deletedAt,
        ];
      }),
      {
        conflict: `ON CONFLICT (airtable_record_id) DO UPDATE SET ${upsertSet(ITEM_COLUMNS, ['airtable_record_id'])}, updated_at = now()`,
        returning: 'id, airtable_record_id',
      },
    );
    const itemIds = new Map<string, string>(itemRows.map((row) => [row.airtable_record_id, row.id]));
    report.items = mapped.length;

    // Children are rebuilt from the mirror each run.
    const allItemIds = [...itemIds.values()];
    for (const table of ['listings', 'item_status_history', 'item_images']) {
      await client.query(`DELETE FROM ${table} WHERE item_id = ANY($1::uuid[])`, [allItemIds]);
    }

    const listingRows = mapped.flatMap(({ record, normalized }) =>
      normalized.listings.map((l) => [
        itemIds.get(record.recordId), l.channel, l.status, l.price, l.quantity, l.externalProductId, l.externalOfferId,
        l.publishedAt, l.closedAt, l.closeResult,
      ]));
    await bulkWrite(client, 'listings',
      ['item_id', 'channel', 'status', 'price', 'quantity', 'external_product_id', 'external_offer_id', 'published_at', 'closed_at', 'close_result'],
      listingRows);
    report.listings = listingRows.length;

    const historyRows = mapped.flatMap(({ record, normalized }) =>
      normalized.statusHistory.map((h) => [itemIds.get(record.recordId), h.status, h.changedAt, h.changedBy]));
    await bulkWrite(client, 'item_status_history', ['item_id', 'status', 'changed_at', 'changed_by'], historyRows);
    report.statusHistory = historyRows.length;

    const imageRows = mapped.flatMap(({ record, normalized }) =>
      normalized.images.map((i) => [itemIds.get(record.recordId), i.position, JSON.stringify(i.attachment), i.altText, i.role]));
    await bulkWrite(client, 'item_images', ['item_id', 'position', 'attachment', 'alt_text', 'role'], imageRows, {
      casts: { attachment: 'jsonb' },
    });
    report.images = imageRows.length;

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return report;
}
