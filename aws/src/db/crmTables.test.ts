import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

if (url) {
  describe('CRM tables (scratch Postgres)', () => {
    const schema = `crm_test_${process.pid}`;
    let client: pg.Client;
    let contactId: string;
    let itemId: string;

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await applyMigrations(client, await loadMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')));
      contactId = (await client.query(`INSERT INTO contacts (email) VALUES ('a@x.com') RETURNING id`)).rows[0].id;
      itemId = (await client.query(`INSERT INTO items (airtable_record_id) VALUES ('rec1') RETURNING id`)).rows[0].id;
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    test('stores interactions, inquiries and follow-ups with defaults', async () => {
      await client.query(`INSERT INTO interactions (contact_id, item_id, kind, summary) VALUES ($1, $2, 'call', 'Quoted offer')`, [contactId, itemId]);
      await client.query(`INSERT INTO inquiries (channel, subject) VALUES ('ebay', 'Is it still available?')`);
      await client.query(`INSERT INTO follow_ups (contact_id, due_at) VALUES ($1, now() + interval '2 days')`, [contactId]);

      assert.equal((await client.query(`SELECT status FROM inquiries`)).rows[0].status, 'open');
      assert.equal((await client.query(`SELECT status FROM follow_ups`)).rows[0].status, 'open');
    });

    test('rejects unknown kinds and a completed timestamp on an open record', async () => {
      await assert.rejects(client.query(`INSERT INTO interactions (contact_id, kind) VALUES ($1, 'carrier-pigeon')`, [contactId]), /check constraint/);
      await assert.rejects(
        client.query(`INSERT INTO follow_ups (contact_id, due_at, completed_at) VALUES ($1, now(), now())`, [contactId]),
        /check constraint/,
      );
      await assert.rejects(client.query(`INSERT INTO inquiries (channel, resolved_at) VALUES ('web', now())`), /check constraint/);
    });

    test('a contact with CRM history cannot be deleted, but removing an item only clears the reference', async () => {
      await assert.rejects(client.query(`DELETE FROM contacts WHERE id = $1`, [contactId]), /foreign key/);
      await client.query(`DELETE FROM items WHERE id = $1`, [itemId]);
      assert.equal((await client.query(`SELECT item_id FROM interactions`)).rows[0].item_id, null);
    });
  });
} else {
  test('CRM tables (skipped: POSTGRES_TEST_URL not set)', { skip: true }, () => undefined);
}
