import type { Client } from 'pg';
import { normalizeListing, phoneKey, type ContactRow, type NormalizedListing } from './normalize.js';

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

// Idempotent and rebuildable: reads only from the mirror and writes only to the normalized tables.
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
    const contactIds = new Map<string, string>();
    for (const contact of contacts) {
      const result = await client.query(
        `INSERT INTO contacts (email, alternate_emails, phone, zip_code, location, mailing_list_opt_in, how_did_you_hear)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           alternate_emails = EXCLUDED.alternate_emails, phone = EXCLUDED.phone, zip_code = EXCLUDED.zip_code, location = EXCLUDED.location,
           mailing_list_opt_in = EXCLUDED.mailing_list_opt_in, how_did_you_hear = EXCLUDED.how_did_you_hear,
           updated_at = now()
         RETURNING id`,
        [contact.email, contact.alternateEmails, contact.phone, contact.zipCode, contact.location, contact.mailingListOptIn, contact.howDidYouHear],
      );
      contactIds.set(contact.email, result.rows[0].id);
    }
    report.contacts = contacts.length;

    for (const { record, normalized } of mapped) {
      const itemId = await upsertItem(client, record, normalized, contactIds, primaryByEmail);
      report.items += 1;

      await client.query('DELETE FROM listings WHERE item_id = $1', [itemId]);
      for (const listing of normalized.listings) {
        await client.query(
          `INSERT INTO listings (item_id, channel, status, price, quantity, external_product_id, external_offer_id,
                                 published_at, closed_at, close_result)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [itemId, listing.channel, listing.status, listing.price, listing.quantity, listing.externalProductId,
            listing.externalOfferId, listing.publishedAt, listing.closedAt, listing.closeResult],
        );
        report.listings += 1;
      }

      await client.query('DELETE FROM item_status_history WHERE item_id = $1', [itemId]);
      for (const entry of normalized.statusHistory) {
        await client.query(
          'INSERT INTO item_status_history (item_id, status, changed_at, changed_by) VALUES ($1, $2, $3, $4)',
          [itemId, entry.status, entry.changedAt, entry.changedBy],
        );
        report.statusHistory += 1;
      }

      await client.query('DELETE FROM item_images WHERE item_id = $1', [itemId]);
      for (const image of normalized.images) {
        await client.query(
          'INSERT INTO item_images (item_id, position, attachment, alt_text, role) VALUES ($1, $2, $3::jsonb, $4, $5)',
          [itemId, image.position, JSON.stringify(image.attachment), image.altText, image.role],
        );
        report.images += 1;
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return report;
}

async function upsertItem(
  client: Client,
  record: MirrorRecord,
  normalized: NormalizedListing,
  contactIds: Map<string, string>,
  primaryByEmail: Map<string, string>,
): Promise<string> {
  const item = normalized.item;
  const result = await client.query(
    `INSERT INTO items (airtable_record_id, sku, make, model, serial_number, component_type, condition, cost,
        offer_amount, paid_amount, arrival_date, workflow_status, workflow_source, jotform_submission_id,
        seller_contact_id, vendor, shopify_order_id, shopify_order_name, post_sale_outcome, post_sale_outcome_at,
        refund_amount, refund_reason, return_received_at, restock_disposition, airtable_created_at, deleted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     ON CONFLICT (airtable_record_id) DO UPDATE SET
        sku = EXCLUDED.sku, make = EXCLUDED.make, model = EXCLUDED.model, serial_number = EXCLUDED.serial_number,
        component_type = EXCLUDED.component_type, condition = EXCLUDED.condition, cost = EXCLUDED.cost,
        offer_amount = EXCLUDED.offer_amount, paid_amount = EXCLUDED.paid_amount, arrival_date = EXCLUDED.arrival_date,
        workflow_status = EXCLUDED.workflow_status, workflow_source = EXCLUDED.workflow_source,
        jotform_submission_id = EXCLUDED.jotform_submission_id, seller_contact_id = EXCLUDED.seller_contact_id,
        vendor = EXCLUDED.vendor, shopify_order_id = EXCLUDED.shopify_order_id,
        shopify_order_name = EXCLUDED.shopify_order_name, post_sale_outcome = EXCLUDED.post_sale_outcome,
        post_sale_outcome_at = EXCLUDED.post_sale_outcome_at, refund_amount = EXCLUDED.refund_amount,
        refund_reason = EXCLUDED.refund_reason, return_received_at = EXCLUDED.return_received_at,
        restock_disposition = EXCLUDED.restock_disposition, airtable_created_at = EXCLUDED.airtable_created_at,
        deleted_at = EXCLUDED.deleted_at, updated_at = now()
     RETURNING id`,
    [record.recordId, item.sku, item.make, item.model, item.serialNumber, item.componentType, item.condition,
      item.cost, item.offerAmount, item.paidAmount, item.arrivalDate, item.workflowStatus, item.workflowSource,
      item.jotformSubmissionId, normalized.contact ? contactIds.get(primaryByEmail.get(normalized.contact.email)!) ?? null : null,
      item.vendor, item.shopifyOrderId, item.shopifyOrderName, item.postSaleOutcome, item.postSaleOutcomeAt,
      item.refundAmount, item.refundReason, item.returnReceivedAt, item.restockDisposition,
      record.airtableCreatedAt, record.deletedAt],
  );
  return result.rows[0].id;
}
