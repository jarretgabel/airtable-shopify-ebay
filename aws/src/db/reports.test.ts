import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';
import { getReportsSummary } from './reports.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

if (url) {
  describe('getReportsSummary (scratch Postgres)', () => {
    const schema = `reports_test_${process.pid}`;
    let client: pg.Client;

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await applyMigrations(client, await loadMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')));
      await client.query(`INSERT INTO items (airtable_record_id, make, cost, workflow_status) VALUES
        ('r1', 'McIntosh', 100, 'Shipped'), ('r2', 'McIntosh', 50, 'Shipped'), ('r3', 'Marantz', 20, 'Pending Review'),
        ('r4', NULL, 10, 'Shipped')`);
      await client.query(`INSERT INTO items (airtable_record_id, make, workflow_status, deleted_at) VALUES ('r5', 'Gone', 'Shipped', now())`);
      await client.query(`INSERT INTO item_status_history (item_id, status, changed_at)
        SELECT id, s.status, s.at::timestamptz FROM items, (VALUES
          ('Pending Review', '2026-01-01'), ('Testing In Progress', '2026-01-03'), ('Shipped', '2026-01-07')) AS s(status, at)
        WHERE airtable_record_id = 'r1'`);
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    test('counts live inventory by status and ignores deleted items', async () => {
      const { inventoryByStatus } = await getReportsSummary(client);
      assert.deepEqual(inventoryByStatus, [{ status: 'Shipped', count: 3 }, { status: 'Pending Review', count: 1 }]);
    });

    test('averages finished stints only', async () => {
      const { timeInStage } = await getReportsSummary(client);
      assert.deepEqual(timeInStage, [
        { status: 'Testing In Progress', avgDays: 4, stints: 1 },
        { status: 'Pending Review', avgDays: 2, stints: 1 },
      ]);
    });

    test('ranks shipped items by brand with total cost', async () => {
      const { shippedByBrand } = await getReportsSummary(client);
      assert.deepEqual(shippedByBrand, [
        { brand: 'McIntosh', count: 2, totalCost: 150 },
        { brand: 'Unknown', count: 1, totalCost: 10 },
      ]);
    });
  });
}
