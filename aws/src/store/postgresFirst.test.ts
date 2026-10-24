import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { applyMigrations, loadMigrations } from '../db/migrator.js';
import { HttpError } from '../shared/errors.js';
import { createPostgresFirstListingStore } from './postgresFirstListingStore.js';
import { createPostgresListingStore } from './postgresListingStore.js';
import { backoffSeconds, getOutboxDepth, runOutbox } from './outboxWorker.js';
import type { ListingRecord, ListingStore } from './listingStore.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

test('backoff grows and is capped', () => {
  assert.deepEqual([1, 2, 3, 20].map(backoffSeconds), [10, 20, 40, 3600]);
});

if (!url) {
  test('postgres-first (skipped: POSTGRES_TEST_URL not set)', { skip: true }, () => undefined);
} else {
  async function harness() {
    const useTls = !/@(localhost|127\.0\.0\.1)/.test(url!);
    const pool = new pg.Pool({ connectionString: url, ssl: useTls ? { rejectUnauthorized: false } : false, max: 4 });
    const client = await pool.connect();
    await applyMigrations(client, await loadMigrations(migrationsDir));
    client.release();
    const baseId = `appTEST${randomBytes(4).toString('hex')}`;
    const tableId = 'tblTEST';
    await pool.query('INSERT INTO airtable_fields (base_id, table_id, field_id, name, type) VALUES ($1,$2,$3,$4,$5),($1,$2,$6,$7,$5)', [baseId, tableId, 'f1', 'Title', 'singleLineText', 'f2', 'Body']);
    await pool.query(`INSERT INTO records (base_id, table_id, record_id, fields, airtable_created_at) VALUES ($1,$2,'rec1','{"Title":"a","Body":"b"}'::jsonb, now())`, [baseId, tableId]);
    const resolveTable = () => ({ baseId, tableId });
    const reader = createPostgresListingStore({ pool, resolveTable });
    const calls: string[] = [];
    const airtableWriter = { createRecord: async () => { calls.push('create'); throw new Error('n/a'); } } as unknown as ListingStore;
    const store = createPostgresFirstListingStore({ pool, resolveTable, airtableWriter, reader });
    return {
      pool, store, baseId, calls, reader,
      async cleanup() {
        await pool.query('DELETE FROM write_outbox WHERE base_id = $1', [baseId]);
        await pool.query('DELETE FROM records WHERE base_id = $1', [baseId]);
        await pool.query('DELETE FROM airtable_fields WHERE base_id = $1', [baseId]);
        await pool.end();
      },
    };
  }

  const okAirtable = (extra: Record<string, unknown> = {}, log: Array<Record<string, unknown>> = []) => ({
    updateRecord: async (_s: unknown, id: string, fields: Record<string, unknown>): Promise<ListingRecord> => {
      log.push(fields);
      return { id, fields: { Title: 'a', Body: 'b', ...fields, ...extra }, createdTime: '' };
    },
  });

  test('postgres-first: update commits to records and the outbox together, unknown fields dropped', async () => {
    const h = await harness();
    try {
      const rec = await h.store.updateRecord('user-guide', 'rec1', { Title: 'new', Nope: 1, Body: null });
      assert.deepEqual(rec.fields, { Title: 'new' });
      assert.deepEqual((await h.reader.getRecord('user-guide', 'rec1')).fields, { Title: 'new' });
      const outbox = await h.pool.query('SELECT fields, status FROM write_outbox WHERE base_id = $1', [h.baseId]);
      assert.deepEqual(outbox.rows, [{ fields: { Title: 'new', Body: null }, status: 'pending' }]);
      await assert.rejects(h.store.updateRecord('user-guide', 'missing', { Title: 'x' }), (e) => e instanceof HttpError && e.statusCode === 404);
      await assert.rejects(h.store.updateRecord('user-guide', 'rec1', { Nope: 1 }), (e) => e instanceof HttpError && e.statusCode === 422);
      assert.equal((await h.pool.query('SELECT 1 FROM write_outbox WHERE base_id = $1', [h.baseId])).rowCount, 1);
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: the worker sends in order, refreshes computed fields, and skips the refresh when a newer write is pending', async () => {
    const h = await harness();
    try {
      const log: Array<Record<string, unknown>> = [];
      await h.store.updateRecord('user-guide', 'rec1', { Title: 'one' });
      await h.store.updateRecord('user-guide', 'rec1', { Title: 'two' });
      const result = await runOutbox({ pool: h.pool, airtable: okAirtable({ Computed: 'x' }, log), sleep: async () => undefined, budgetMs: 5000 });
      assert.equal(result.sent, 2);
      assert.deepEqual(log, [{ Title: 'one' }, { Title: 'two' }]);
      assert.deepEqual((await h.reader.getRecord('user-guide', 'rec1')).fields, { Title: 'two', Body: 'b', Computed: 'x' });
      assert.deepEqual(await getOutboxDepth(h.pool), { pending: 0, dead: 0, oldestPendingSeconds: 0 });
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: retryable failures back off and block later writes to the same record; permanent failures go dead', async () => {
    const h = await harness();
    try {
      await h.store.updateRecord('user-guide', 'rec1', { Title: 'one' });
      await h.store.updateRecord('user-guide', 'rec1', { Title: 'two' });
      const failing = (error: Error) => ({ updateRecord: async () => { throw error; } });
      const transient = new HttpError(503, 'down', { service: 'airtable', code: 'X', retryable: true });
      let r = await runOutbox({ pool: h.pool, airtable: failing(transient), sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(r.retried, 1);
      assert.equal((await h.pool.query(`SELECT 1 FROM write_outbox WHERE base_id = $1 AND status = 'pending'`, [h.baseId])).rowCount, 2);

      await h.pool.query(`UPDATE write_outbox SET next_attempt_at = now() WHERE base_id = $1`, [h.baseId]);
      const permanent = new HttpError(422, 'bad', { service: 'airtable', code: 'INVALID', retryable: false });
      r = await runOutbox({ pool: h.pool, airtable: failing(permanent), sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(r.dead, 1);
      // The dead row blocks the later write for the same record.
      r = await runOutbox({ pool: h.pool, airtable: okAirtable(), sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(r.sent, 0);
      assert.deepEqual(await getOutboxDepth(h.pool), { pending: 1, dead: 1, oldestPendingSeconds: (await getOutboxDepth(h.pool)).oldestPendingSeconds });
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: creates go through the Airtable-first writer', async () => {
    const h = await harness();
    try {
      await assert.rejects(h.store.createRecord('user-guide', { Title: 'x' }));
      assert.deepEqual(h.calls, ['create']);
    } finally {
      await h.cleanup();
    }
  });
}
