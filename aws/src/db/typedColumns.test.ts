import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

if (url) {
  describe('typed columns on records (scratch Postgres)', () => {
    const schema = `typed_test_${process.pid}`;
    let client: pg.Client;

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await applyMigrations(client, await loadMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')));
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    const insert = (id: string, fields: Record<string, unknown>) =>
      client.query(`INSERT INTO records (base_id, table_id, record_id, fields) VALUES ('b', 't', $1, $2)`, [id, JSON.stringify(fields)]);
    const row = async (id: string) =>
      (await client.query(`SELECT workflow_status, sku, pick_up_id, email, price FROM records WHERE record_id = $1`, [id])).rows[0];

    test('derives columns from the JSON, including {text} wrappers', async () => {
      await insert('r1', { 'Workflow Status': 'Pending Review', SKU: { text: ' 123 ' }, 'Pick Up ID': 'P-1', Email: ' A@X.com ', 'Ebay Price': 1899.5 });
      assert.deepEqual(await row('r1'), { workflow_status: 'Pending Review', sku: '123', pick_up_id: 'P-1', email: 'a@x.com', price: '1899.5' });
    });

    test('plain string SKU, missing fields and blanks become null', async () => {
      await insert('r2', { SKU: '456', 'Pick Up ID': '  ', Email: '' });
      assert.deepEqual(await row('r2'), { workflow_status: null, sku: '456', pick_up_id: null, email: null, price: null });
    });

    test('a non-numeric price never breaks a write and stays null', async () => {
      await insert('r3', { 'Ebay Price': 'call us' });
      assert.equal((await row('r3')).price, null);
    });

    test('columns follow updates to the JSON', async () => {
      await client.query(`UPDATE records SET fields = jsonb_set(fields, '{Workflow Status}', '"Approved for Publish"') WHERE record_id = 'r1'`);
      assert.equal((await row('r1')).workflow_status, 'Approved for Publish');
    });
  });
}
