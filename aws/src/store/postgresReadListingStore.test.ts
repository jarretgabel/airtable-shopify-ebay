import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresReadListingStore } from './postgresReadListingStore.js';
import type { ListingRecord, ListingStore } from './listingStore.js';

function setup(readerFails = false) {
  const calls: string[] = [];
  const falls: string[] = [];
  const rec = (from: string): ListingRecord => ({ id: from, fields: {}, createdTime: '' });
  const make = (name: string, fail = false) => ({
    getRecords: async () => { calls.push(`${name}.getRecords`); if (fail) throw new Error('boom'); return [rec(name)]; },
    getRecord: async () => { calls.push(`${name}.getRecord`); if (fail) throw new Error('boom'); return rec(name); },
    getRecordsSummary: async () => { calls.push(`${name}.summary`); return { total: 0, approved: 0, pending: 0 }; },
    getFieldMetadata: async () => { calls.push(`${name}.metadata`); return []; },
    createRecord: async () => { calls.push(`${name}.create`); return rec(name); },
    updateRecord: async () => { calls.push(`${name}.update`); return rec(name); },
    deleteRecord: async () => { calls.push(`${name}.delete`); },
    uploadAttachment: async () => { calls.push(`${name}.attachment`); },
  }) as unknown as ListingStore;
  const store = createPostgresReadListingStore({
    reader: make('pg', readerFails), fallback: make('airtable'), writer: make('dual'),
    onFallback: (op) => falls.push(op),
  });
  return { store, calls, falls };
}

test('postgres-read: reads come from Postgres, writes and metadata do not', async () => {
  const { store, calls, falls } = setup();
  assert.equal((await store.getRecords('shopify-vendors'))[0].id, 'pg');
  assert.equal((await store.getRecord('shopify-vendors', 'x')).id, 'pg');
  await store.getRecordsSummary('shopify-vendors');
  await store.getFieldMetadata('inventory-directory');
  await store.createRecord('shopify-vendors', {});
  await store.updateRecord('shopify-vendors', 'x', {});
  await store.deleteRecord('shopify-vendors', 'x');
  await store.uploadAttachment('inventory-directory', 'x', 'f', { filename: 'a', contentType: 'b', file: 'c' });
  assert.deepEqual(calls, ['pg.getRecords', 'pg.getRecord', 'pg.summary', 'airtable.metadata', 'dual.create', 'dual.update', 'dual.delete', 'dual.attachment']);
  assert.deepEqual(falls, []);
});

test('postgres-read: a failing Postgres read falls back to Airtable and is reported', async () => {
  const { store, calls, falls } = setup(true);
  assert.equal((await store.getRecords('shopify-vendors'))[0].id, 'airtable');
  assert.equal((await store.getRecord('shopify-vendors', 'x')).id, 'airtable');
  assert.deepEqual(calls, ['pg.getRecords', 'airtable.getRecords', 'pg.getRecord', 'airtable.getRecord']);
  assert.deepEqual(falls, ['getRecords', 'getRecord']);
});
