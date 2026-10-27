import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { addFollowUp, addInteraction, closeFollowUp, getContactDetail, listContacts, listDueFollowUps } from './crm.js';
import { applyMigrations, loadMigrations } from './migrator.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

if (url) {
  describe('crm (scratch Postgres)', () => {
    const schema = `crm_test_${process.pid}`;
    let client: pg.Client;
    let contactId = '';

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await applyMigrations(client, await loadMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')));
      contactId = (await client.query(`INSERT INTO contacts (email, name) VALUES ('a@x.com', 'Ann'), ('b@x.com', 'Bob') RETURNING id`)).rows[0].id;
      await client.query(`INSERT INTO items (airtable_record_id, sku, make, seller_contact_id) VALUES ('r1', '100', 'McIntosh', $1)`, [contactId]);
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    test('searches contacts and treats % and _ literally', async () => {
      assert.deepEqual((await listContacts(client, 'ann')).map((c) => [c.email, c.itemCount]), [['a@x.com', 1]]);
      assert.equal((await listContacts(client, '%')).length, 0);
    });

    test('records notes and follow-ups and shows them on the contact', async () => {
      assert.equal(await addInteraction(client, contactId, 'call', 'Discussed pricing', 'admin@x.com'), true);
      assert.equal(await addFollowUp(client, contactId, '2020-01-01T00:00:00Z', 'Call back', 'admin@x.com'), true);
      const detail = await getContactDetail(client, contactId);
      assert.equal(detail?.items[0].sku, '100');
      assert.equal(detail?.interactions[0].summary, 'Discussed pricing');
      assert.equal(detail?.followUps[0].status, 'open');
    });

    test('unknown contacts are rejected and nothing is inserted', async () => {
      const missing = '00000000-0000-0000-0000-000000000000';
      assert.equal(await addInteraction(client, missing, 'note', 'x', 'a'), false);
      assert.equal(await addFollowUp(client, missing, '2030-01-01T00:00:00Z', 'x', 'a'), false);
      assert.equal(await getContactDetail(client, missing), null);
    });

    test('lists due follow-ups and closes each only once', async () => {
      const due = await listDueFollowUps(client);
      assert.equal(due.length, 1);
      assert.equal(due[0].contactEmail, 'a@x.com');
      assert.equal(await closeFollowUp(client, due[0].id, 'done'), true);
      assert.equal(await closeFollowUp(client, due[0].id, 'done'), false);
      assert.equal((await listDueFollowUps(client)).length, 0);
    });
  });
}
