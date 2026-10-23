import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from '../db/migrator.js';
import { HttpError } from '../shared/errors.js';
import { createPostgresListingStore } from './postgresListingStore.js';
import { createPostgresMirror } from './postgresMirror.js';
import { runListingStoreContract } from './listingStore.contract.js';
import type { ListingStore } from './listingStore.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');
const METADATA_FIELDS = [{ id: 'fldName', name: 'Name', type: 'singleLineText' }];

async function createHarness() {
  const useTls = !/@(localhost|127\.0\.0\.1)/.test(url!);
  const pool = new pg.Pool({ connectionString: url, ssl: useTls ? { rejectUnauthorized: false } : false, max: 2 });
  const client = await pool.connect();
  await applyMigrations(client, await loadMigrations(migrationsDir));
  client.release();

  const baseId = `appTEST${randomBytes(4).toString('hex')}`;
  const tableId = 'tblTEST';
  const store = createPostgresListingStore({ pool, resolveTable: () => ({ baseId, tableId }) });

  async function seed(records: Array<{ id: string; fields: Record<string, unknown> }>) {
    await pool.query('DELETE FROM records WHERE base_id = $1', [baseId]);
    for (const record of records) {
      await pool.query(
        'INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at) VALUES ($1, $2, $3, $4::jsonb, now())',
        [baseId, tableId, record.id, JSON.stringify(record.fields)],
      );
    }
  }

  for (const field of METADATA_FIELDS) {
    await pool.query(
      'INSERT INTO airtable_fields (base_id, table_id, field_id, name, type) VALUES ($1, $2, $3, $4, $5)',
      [baseId, tableId, field.id, field.name, field.type],
    );
  }

  return {
    pool,
    baseId,
    tableId,
    store,
    seed,
    allowedAttachmentFieldId: 'fldMXp0EaUHGglU8M',
    attachments: 'not-implemented' as const,
    metadataFields: METADATA_FIELDS,
    async cleanup() {
      await pool.query('DELETE FROM records WHERE base_id = $1', [baseId]);
      await pool.query('DELETE FROM airtable_fields WHERE base_id = $1', [baseId]);
      await pool.end();
    },
  };
}

if (!url) {
  test('postgresListingStore (skipped: POSTGRES_TEST_URL not set)', { skip: true }, () => undefined);
} else {
  runListingStoreContract('postgres', createHarness);

  async function withStore(fn: (store: ListingStore, seed: Awaited<ReturnType<typeof createHarness>>['seed']) => Promise<void>) {
    const harness = await createHarness();
    try {
      await fn(harness.store, harness.seed);
    } finally {
      await harness.cleanup();
    }
  }

  const listings = [
    { id: 'rec1', fields: { Title: 'McIntosh MC275', 'Workflow Status': 'Approved for Publish', Notes: 'tube amp' } },
    { id: 'rec2', fields: { Title: 'Marantz 2270', 'Workflow Status': 'Listed, eBay' } },
    { id: 'rec3', fields: { Title: 'Pioneer SX-1250', 'Workflow Status': 'Accepted' } },
    { id: 'rec4', fields: { Title: 'Sold', 'Workflow Status': 'Shipped' } },
  ];

  test('postgres: subsets select by Workflow Status and enforce the source', () => withStore(async (store, seed) => {
    await seed(listings);
    const ready = await store.getRecords('approval-combined', { subset: 'ready-for-publishing' });
    assert.deepEqual(ready.map((r) => r.id), ['rec1']);

    const page = await store.getRecords('approval-combined', { subset: 'listings-page' });
    assert.deepEqual(page.map((r) => r.id).sort(), ['rec1', 'rec2']);

    await assert.rejects(
      store.getRecords('users', { subset: 'listings-page' }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    );
  }));

  test('postgres: search is a case-insensitive substring match across the requested fields', () => withStore(async (store, seed) => {
    await seed(listings);
    const hits = await store.getRecords('approval-combined', { searchQuery: ' MCINTOSH ', searchFields: ['Title', 'Notes'] });
    assert.deepEqual(hits.map((r) => r.id), ['rec1']);
    const viaNotes = await store.getRecords('approval-combined', { searchQuery: 'tube', searchFields: ['Title', 'Notes'] });
    assert.deepEqual(viaNotes.map((r) => r.id), ['rec1']);
    const wildcard = await store.getRecords('approval-combined', { searchQuery: '%', searchFields: ['Title'] });
    assert.equal(wildcard.length, 0);
  }));

  test('postgres: equality formulas used by auth lookups, and others are rejected', () => withStore(async (store, seed) => {
    await seed([
      { id: 'u1', fields: { Email: 'Jane@Example.com', 'User Id': 'abc' } },
      { id: 'u2', fields: { Email: 'other@example.com', 'User Id': 'def' } },
    ]);
    assert.deepEqual((await store.getRecords('users', { filterByFormula: '{Email} = "Jane@Example.com"' })).map((r) => r.id), ['u1']);
    assert.deepEqual((await store.getRecords('users', { filterByFormula: 'LOWER({Email}) = "jane@example.com"' })).map((r) => r.id), ['u1']);
    assert.deepEqual((await store.getRecords('users', { filterByFormula: '{User Id} = "def"' })).map((r) => r.id), ['u2']);
    await assert.rejects(
      store.getRecords('users', { filterByFormula: 'OR({Email} = "a", {Email} = "b")' }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400,
    );
  }));

  test('postgres: null clears a field, deleted records stay hidden, missing records are 404', () => withStore(async (store, seed) => {
    await seed([{ id: 'rec1', fields: { Name: 'A', Order: 1 } }]);
    const updated = await store.updateRecord('user-guide', 'rec1', { Order: null });
    assert.deepEqual(updated.fields, { Name: 'A' });
    await store.deleteRecord('user-guide', 'rec1');
    assert.deepEqual(await store.getRecords('user-guide'), []);
    await assert.rejects(store.deleteRecord('user-guide', 'rec1'), (error: unknown) => error instanceof HttpError && error.statusCode === 404);
    await assert.rejects(store.updateRecord('user-guide', 'nope', { A: 1 }), (error: unknown) => error instanceof HttpError && error.statusCode === 404);
  }));

  test('postgres mirror: upserts the exact Airtable record, is idempotent, and soft-deletes', async () => {
    const harness = await createHarness();
    try {
      const table = { baseId: harness.baseId, tableId: harness.tableId };
      const mirror = createPostgresMirror(() => harness.pool, () => table);
      const record = { id: 'recAT1', fields: { Name: 'Vendor' }, createdTime: '2026-01-02T03:04:05.000Z' };

      await mirror.upsertRecord('shopify-vendors', record);
      await mirror.upsertRecord('shopify-vendors', { ...record, fields: { Name: 'Vendor 2' } });
      const fetched = await harness.store.getRecord('shopify-vendors', 'recAT1');
      assert.deepEqual(fetched.fields, { Name: 'Vendor 2' });
      assert.equal(fetched.createdTime, record.createdTime);
      assert.equal((await harness.store.getRecords('shopify-vendors')).length, 1);

      await mirror.markDeleted('shopify-vendors', 'recAT1');
      await assert.rejects(harness.store.getRecord('shopify-vendors', 'recAT1'), (error: unknown) => error instanceof HttpError && error.statusCode === 404);

      await mirror.upsertRecord('shopify-vendors', record);
      assert.deepEqual((await harness.store.getRecord('shopify-vendors', 'recAT1')).fields, { Name: 'Vendor' });
    } finally {
      await harness.cleanup();
    }
  });
}
