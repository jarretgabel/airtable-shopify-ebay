import assert from 'node:assert/strict';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from './migrator.js';
import { normalizeListings, type MirrorRecord } from './normalizeApply.js';
import { getSellersSummary } from './sellersSummary.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;

const rec = (recordId: string, fields: Record<string, unknown>, deletedAt: string | null = null): MirrorRecord => ({
  recordId, fields, airtableCreatedAt: '2026-01-01T00:00:00.000Z', deletedAt,
});

if (url) {
  describe('getSellersSummary (scratch Postgres)', () => {
    const schema = `sellers_test_${process.pid}`;
    let client: pg.Client;

    before(async () => {
      client = new pg.Client({ connectionString: url, ssl: /@(localhost|127\.0\.0\.1)/.test(url) ? false : { rejectUnauthorized: false } });
      await client.connect();
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET search_path TO ${schema}`);
      await applyMigrations(client, await loadMigrations(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations')));
      await normalizeListings(client, [
        rec('r1', { 'Seller Email': 'a@x.com', 'Seller Location': 'NYC', 'Arrival Date': '2026-03-01', 'Mailing List Opt In': true }),
        rec('r2', { 'Seller Email': 'a@x.com', 'Arrival Date': '2026-05-01' }),
        rec('r3', { 'Seller Email': 'b@x.com', 'Arrival Date': '2026-04-01' }),
        rec('r4', { 'Seller Email': 'c@x.com' }, '2026-06-01T00:00:00.000Z'),
        rec('r5', { Make: 'NoSeller' }),
      ]);
    });

    after(async () => {
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    });

    test('summarizes totals and ranks sellers by item count', async () => {
      const summary = await getSellersSummary(client, 10);
      assert.deepEqual(summary.totals, { contacts: 3, sellersWithItems: 2, repeatSellers: 1, mailingListOptIns: 1 });
      assert.deepEqual(summary.topSellers.map((s) => [s.email, s.itemCount, s.lastItemDate]), [
        ['a@x.com', 2, '2026-05-01'],
        ['b@x.com', 1, '2026-04-01'],
        ['c@x.com', 0, null],
      ]);
      assert.equal(summary.topSellers[0].mailingListOptIn, true);
    });

    test('caps the row limit', async () => {
      assert.equal((await getSellersSummary(client, 1)).topSellers.length, 1);
      assert.equal((await getSellersSummary(client, 9999)).topSellers.length, 3);
    });
  });
} else {
  test('getSellersSummary (skipped: POSTGRES_TEST_URL not set)', { skip: true }, () => undefined);
}
