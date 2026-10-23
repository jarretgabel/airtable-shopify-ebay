import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before, describe } from 'node:test';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';
import { normalizeListings, type MirrorRecord } from './normalizeApply.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

const records: MirrorRecord[] = [
  { recordId: 'rec1', airtableCreatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null, fields: {
    'Seller Email': 'a@x.com', 'Seller Phone': '111', Make: 'Marantz', 'Workflow Status': 'Listed',
    'eBay Listing ID': '1', 'Accepted At': '2026-05-03T14:00:00.000Z', Images: [{ id: 'att1' }] } },
  { recordId: 'rec2', airtableCreatedAt: '2026-02-01T00:00:00.000Z', deletedAt: null, fields: {
    'Seller Email': 'A@x.com', 'Seller Phone': '222', Make: 'Luxman', 'Shopify REST Product ID': '9' } },
  { recordId: 'rec3', airtableCreatedAt: '2026-03-01T00:00:00.000Z', deletedAt: null, fields: { Make: 'NoEmail' } },
];

if (url) {
  describe('normalizeListings (scratch Postgres)', () => {
    const schema = `norm_test_${process.pid}`;
    let client: pg.Client;

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
      await applyMigrations(client, await loadMigrations(dir));
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    test('fills the normalized tables and is idempotent', async () => {
      const first = await normalizeListings(client, records);
      assert.deepEqual(
        [first.contacts, first.items, first.listings, first.statusHistory, first.images, first.recordsWithoutEmail],
        [1, 3, 2, 1, 1, 1],
      );
      await normalizeListings(client, records);

      const counts = await client.query(
        `SELECT (SELECT count(*) FROM contacts)::int AS contacts, (SELECT count(*) FROM items)::int AS items,
                (SELECT count(*) FROM listings)::int AS listings, (SELECT count(*) FROM item_status_history)::int AS history,
                (SELECT count(*) FROM item_images)::int AS images`,
      );
      assert.deepEqual(counts.rows[0], { contacts: 1, items: 3, listings: 2, history: 1, images: 1 });

      const contact = await client.query('SELECT phone FROM contacts WHERE email = $1', ['a@x.com']);
      assert.equal(contact.rows[0].phone, '222');
      const linked = await client.query('SELECT count(*)::int AS n FROM items WHERE seller_contact_id IS NOT NULL');
      assert.equal(linked.rows[0].n, 2);
    });
  });
} else {
  test('normalizeListings (skipped: POSTGRES_TEST_URL not set)', { skip: true }, () => undefined);
}
