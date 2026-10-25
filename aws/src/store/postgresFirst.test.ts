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
import { copyAttachmentsForField } from '../db/copyAttachments.js';
import { isValidMediaKey, type MediaStore } from '../providers/media/mediaStore.js';
import { backoffSeconds, getOutboxDepth, runOutbox } from './outboxWorker.js';
import type { ListingRecord, ListingStore } from './listingStore.js';

// Needs a scratch Postgres: POSTGRES_TEST_URL=postgres://... npm test. Skipped otherwise.
const url = process.env.POSTGRES_TEST_URL;
const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../db/migrations');

test('backoff grows and is capped', () => {
  assert.deepEqual([1, 2, 3, 20].map(backoffSeconds), [10, 20, 40, 3600]);
});

test('media keys reject traversal and odd characters', () => {
  assert.equal(isValidMediaKey('tbl1/rec1/fld1/att1-photo.jpg'), true);
  assert.equal(isValidMediaKey('tbl1/../secret'), false);
  assert.equal(isValidMediaKey('tbl1//x'), false);
  assert.equal(isValidMediaKey('tbl1/a b'), false);
  assert.equal(isValidMediaKey(''), false);
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

  const unused = async (): Promise<never> => { throw new Error('unexpected call'); };
  const okAirtable = (extra: Record<string, unknown> = {}, log: Array<Record<string, unknown>> = []) => ({
    createRecord: unused,
    deleteRecord: unused,
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
      const failing = (error: Error) => ({ createRecord: unused, deleteRecord: unused, updateRecord: async () => { throw error; } });
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

  const createAirtable = (calls: string[], failWith?: Error) => ({
    updateRecord: async (_s: unknown, id: string, fields: Record<string, unknown>): Promise<ListingRecord> => {
      calls.push(`update:${id}`);
      return { id, fields, createdTime: '' };
    },
    createRecord: async (_s: unknown, fields: Record<string, unknown>): Promise<ListingRecord> => {
      calls.push('create');
      if (failWith) throw failWith;
      return { id: 'recAIRTABLE0000001', fields: { ...fields, Computed: 'x' }, createdTime: '2026-01-01T00:00:00.000Z' };
    },
    deleteRecord: async (_s: unknown, id: string): Promise<void> => {
      calls.push(`delete:${id}`);
    },
  });

  test('postgres-first: a create returns a local id at once, then later writes use the id Airtable issued', async () => {
    const h = await harness();
    try {
      const created = await h.store.createRecord('user-guide', { Title: 'new', Nope: 1 });
      assert.match(created.id, /^rec[A-Za-z0-9]{14}$/);
      assert.deepEqual((await h.reader.getRecord('user-guide', created.id)).fields, { Title: 'new' });
      await h.store.updateRecord('user-guide', created.id, { Body: 'later' });
      await assert.rejects(h.store.createRecord('user-guide', { Nope: 1 }), (e) => e instanceof HttpError && e.statusCode === 422);

      const calls: string[] = [];
      const result = await runOutbox({ pool: h.pool, airtable: createAirtable(calls), sleep: async () => undefined, budgetMs: 5000 });
      assert.equal(result.sent, 2);
      assert.deepEqual(calls, ['create', 'update:recAIRTABLE0000001']);
      const row = await h.pool.query('SELECT airtable_record_id FROM records WHERE base_id = $1 AND record_id = $2', [h.baseId, created.id]);
      assert.equal(row.rows[0].airtable_record_id, 'recAIRTABLE0000001');
      assert.deepEqual(await getOutboxDepth(h.pool), { pending: 0, dead: 0, oldestPendingSeconds: 0 });
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: an ambiguous create failure goes dead without retrying, a rate limit is retried', async () => {
    const h = await harness();
    try {
      await h.store.createRecord('user-guide', { Title: 'new' });
      const ambiguous = new HttpError(503, 'down', { service: 'airtable', code: 'X', retryable: true });
      let r = await runOutbox({ pool: h.pool, airtable: createAirtable([], ambiguous), sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(r.dead, 1);

      await h.pool.query('DELETE FROM write_outbox WHERE base_id = $1', [h.baseId]);
      await h.store.createRecord('user-guide', { Title: 'again' });
      const limited = new HttpError(429, 'slow down', { service: 'airtable', code: 'RATE', retryable: true });
      r = await runOutbox({ pool: h.pool, airtable: createAirtable([], limited), sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(r.retried, 1);
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: a delete is soft in Postgres and sent to Airtable by its Airtable id; a 404 there counts as done', async () => {
    const h = await harness();
    try {
      await h.store.deleteRecord('user-guide', 'rec1');
      await assert.rejects(h.reader.getRecord('user-guide', 'rec1'), (e) => e instanceof HttpError && e.statusCode === 404);
      await assert.rejects(h.store.deleteRecord('user-guide', 'rec1'), (e) => e instanceof HttpError && e.statusCode === 404);

      const calls: string[] = [];
      const gone = { ...createAirtable(calls), deleteRecord: async () => { throw new HttpError(404, 'gone', { service: 'airtable', code: 'NOT_FOUND' }); } };
      const result = await runOutbox({ pool: h.pool, airtable: gone, sleep: async () => undefined, budgetMs: 2000 });
      assert.equal(result.sent, 1);
    } finally {
      await h.cleanup();
    }
  });

  test('postgres-first: a link to a record whose create is still pending waits, then is rewritten to the Airtable id', async () => {
    const h = await harness();
    try {
      const target = await h.store.createRecord('user-guide', { Title: 'target' });
      await h.pool.query('INSERT INTO airtable_fields (base_id, table_id, field_id, name, type) VALUES ($1, $2, $3, $4, $5)', [h.baseId, 'tblTEST', 'f3', 'Links', 'multipleRecordLinks']);
      await h.store.updateRecord('user-guide', 'rec1', { Links: [target.id] });

      const seen: Array<Record<string, unknown>> = [];
      const airtable = {
        ...createAirtable([]),
        updateRecord: async (_s: unknown, id: string, fields: Record<string, unknown>): Promise<ListingRecord> => {
          seen.push(fields);
          return { id, fields, createdTime: '' };
        },
      };
      const failingCreate = { ...airtable, createRecord: async () => { throw new HttpError(429, 'slow', { service: 'airtable', code: 'RATE', retryable: true }); } };
      const first = await runOutbox({ pool: h.pool, airtable: failingCreate, sleep: async () => undefined, budgetMs: 1500 });
      assert.equal(first.sent, 0);
      assert.equal(seen.length, 0);

      await h.pool.query('UPDATE write_outbox SET next_attempt_at = now() WHERE base_id = $1', [h.baseId]);
      const second = await runOutbox({ pool: h.pool, airtable: { ...createAirtable([]), updateRecord: airtable.updateRecord }, sleep: async () => undefined, budgetMs: 3000 });
      assert.equal(second.sent, 2);
      assert.deepEqual(seen, [{ Links: ['recAIRTABLE0000001'] }]);
    } finally {
      await h.cleanup();
    }
  });

  function fakeMedia(): MediaStore & { objects: Map<string, Buffer> } {
    const objects = new Map<string, Buffer>();
    return {
      objects,
      put: async (key, body) => { objects.set(key, body); },
      signedUrl: async (key) => `https://signed.example/${key}`,
      publicUrl: (key) => `/api/media/${key}`,
    };
  }

  async function withImagesField(h: Awaited<ReturnType<typeof harness>>) {
    await h.pool.query('INSERT INTO airtable_fields (base_id, table_id, field_id, name, type) VALUES ($1, $2, $3, $4, $5)', [h.baseId, 'tblTEST', 'fldImg', 'Images', 'multipleAttachments']);
  }

  test('postgres-first: an upload goes to S3, is recorded on the record, queues no Airtable write, and survives a refresh from Airtable', async () => {
    const h = await harness();
    try {
      await withImagesField(h);
      const media = fakeMedia();
      const store = createPostgresFirstListingStore({
        pool: h.pool, resolveTable: () => ({ baseId: h.baseId, tableId: 'tblTEST' }),
        airtableWriter: {} as ListingStore, reader: h.reader, media,
      });
      await store.uploadAttachment('used-gear-workflow', 'rec1', 'fldImg', { filename: 'My Photo.jpg', contentType: 'image/jpeg', file: Buffer.from('abc').toString('base64') });
      await assert.rejects(store.uploadAttachment('used-gear-workflow', 'rec1', 'f1', { filename: 'x', contentType: 'x', file: '' }), (e) => e instanceof HttpError && e.statusCode === 400);

      const images = (await h.reader.getRecord('user-guide', 'rec1')).fields.Images as Array<Record<string, unknown>>;
      assert.equal(images.length, 1);
      assert.match(String(images[0].s3Key), /^tblTEST\/rec1\/fldImg\/att[0-9a-f]{16}-My-Photo\.jpg$/);
      assert.equal(media.objects.get(String(images[0].s3Key))?.toString(), 'abc');
      assert.equal((await h.pool.query('SELECT 1 FROM write_outbox WHERE base_id = $1', [h.baseId])).rowCount, 0);

      // A later Airtable-confirmed update must not wipe the S3-only attachment.
      await store.updateRecord('user-guide', 'rec1', { Title: 'edited' });
      await runOutbox({ pool: h.pool, airtable: okAirtable({ Images: [] }), sleep: async () => undefined, budgetMs: 3000 });
      const after = (await h.reader.getRecord('user-guide', 'rec1')).fields.Images as unknown[];
      assert.equal(after.length, 1);
    } finally {
      await h.cleanup();
    }
  });

  test('copy attachments: dry run counts, apply copies to S3 and repoints Postgres, rerun skips', async () => {
    const h = await harness();
    try {
      await withImagesField(h);
      const old = [{ id: 'attA', url: 'https://airtable.example/a', filename: 'a.jpg', type: 'image/jpeg', size: 3, thumbnails: { large: { url: 'x' } } }];
      await h.pool.query(`UPDATE records SET fields = fields || $3::jsonb WHERE base_id = $1 AND record_id = $2`, [h.baseId, 'rec1', JSON.stringify({ Images: old })]);
      const media = fakeMedia();
      const base = {
        client: h.pool, baseId: h.baseId, tableId: 'tblTEST', fieldName: 'Images', media,
        records: [{ id: 'rec1', fields: { Images: old } }],
        download: async () => Buffer.from('abc'),
      };
      const dry = await copyAttachmentsForField({ ...base, apply: false });
      assert.deepEqual(dry, { records: 1, files: 1, bytes: 3, copied: 0, skipped: 0 });
      assert.equal(media.objects.size, 0);

      const applied = await copyAttachmentsForField({ ...base, apply: true });
      assert.equal(applied.copied, 1);
      const stored = (await h.reader.getRecord('user-guide', 'rec1')).fields.Images as Array<Record<string, unknown>>;
      assert.equal(stored[0].s3Key, 'tblTEST/rec1/attA/a.jpg');
      assert.equal(stored[0].url, '/api/media/tblTEST/rec1/attA/a.jpg');
      assert.equal(stored[0].airtableUrl, 'https://airtable.example/a');
      assert.equal('thumbnails' in stored[0], false);

      const again = await copyAttachmentsForField({ ...base, apply: true });
      assert.deepEqual([again.copied, again.skipped], [0, 1]);
    } finally {
      await h.cleanup();
    }
  });
}
