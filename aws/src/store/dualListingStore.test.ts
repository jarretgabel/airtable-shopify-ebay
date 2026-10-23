import assert from 'node:assert/strict';
import test from 'node:test';
import { createDualListingStore } from './dualListingStore.js';
import type { ListingRecord, ListingStore } from './listingStore.js';
import type { PostgresMirror } from './postgresMirror.js';
import type { ShadowReport } from './shadowRead.js';

function setup(options: { primaryFails?: boolean; mirrorFails?: boolean } = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  const record: ListingRecord = { id: 'rec1', fields: { Name: 'A' }, createdTime: '2026-01-01T00:00:00.000Z' };
  const fail = (what: string) => { throw new Error(`${what} failed`); };

  const primary = {
    getRecords: async () => { calls.push('primary.getRecords'); return [record]; },
    getRecord: async () => { calls.push('primary.getRecord'); return record; },
    getRecordsSummary: async () => ({ total: 1, approved: 0, pending: 1 }),
    getFieldMetadata: async () => [],
    createRecord: async () => { calls.push('primary.create'); if (options.primaryFails) fail('primary'); return record; },
    updateRecord: async () => { calls.push('primary.update'); if (options.primaryFails) fail('primary'); return record; },
    deleteRecord: async () => { calls.push('primary.delete'); if (options.primaryFails) fail('primary'); },
    uploadAttachment: async () => { calls.push('primary.attachment'); if (options.primaryFails) fail('primary'); },
  } as ListingStore;
  const mirror: PostgresMirror = {
    upsertRecord: async () => { calls.push('mirror.upsert'); if (options.mirrorFails) fail('mirror'); },
    markDeleted: async () => { calls.push('mirror.delete'); if (options.mirrorFails) fail('mirror'); },
  };
  const store = createDualListingStore({ primary, mirror, onMirrorError: (operation) => errors.push(operation) });
  return { store, calls, errors };
}

test('dual: writes go to Airtable first, then the mirror', async () => {
  const { store, calls } = setup();
  await store.createRecord('shopify-vendors', {});
  await store.updateRecord('shopify-vendors', 'rec1', {});
  await store.deleteRecord('shopify-vendors', 'rec1');
  await store.uploadAttachment('inventory-directory', 'rec1', 'fld', { filename: 'a', contentType: 'b', file: 'c' });
  assert.deepEqual(calls, [
    'primary.create', 'mirror.upsert',
    'primary.update', 'mirror.upsert',
    'primary.delete', 'mirror.delete',
    'primary.attachment', 'primary.getRecord', 'mirror.upsert',
  ]);
});

test('dual: reads never touch the mirror', async () => {
  const { store, calls } = setup();
  await store.getRecords('shopify-vendors');
  await store.getRecord('shopify-vendors', 'rec1');
  assert.deepEqual(calls, ['primary.getRecords', 'primary.getRecord']);
});

test('dual: an Airtable failure propagates and nothing is mirrored', async () => {
  const { store, calls } = setup({ primaryFails: true });
  await assert.rejects(store.createRecord('shopify-vendors', {}), /primary failed/);
  await assert.rejects(store.deleteRecord('shopify-vendors', 'rec1'), /primary failed/);
  assert.deepEqual(calls, ['primary.create', 'primary.delete']);
});

test('dual: a mirror failure is reported but the request still succeeds', async () => {
  const { store, errors } = setup({ mirrorFails: true });
  const created = await store.createRecord('shopify-vendors', {});
  assert.equal(created.id, 'rec1');
  await store.updateRecord('shopify-vendors', 'rec1', {});
  await store.deleteRecord('shopify-vendors', 'rec1');
  assert.deepEqual(errors, ['create', 'update', 'delete']);
});

test('dual: a throwing error reporter still does not fail the request', async () => {
  const { store } = setup({ mirrorFails: true });
  const throwing = createDualListingStore({
    primary: (store as unknown) as ListingStore,
    mirror: { upsertRecord: async () => { throw new Error('x'); }, markDeleted: async () => undefined },
    onMirrorError: () => { throw new Error('reporter down'); },
  });
  assert.equal((await throwing.createRecord('shopify-vendors', {})).id, 'rec1');
});

function shadowSetup(shadow: Partial<ListingStore>, opts: { timeoutMs?: number } = {}) {
  const record: ListingRecord = { id: 'rec1', fields: { Name: 'A' }, createdTime: '2026-01-01T00:00:00.000Z' };
  const reports: ShadowReport[] = [];
  const primary = { getRecords: async () => [record], getRecord: async () => record } as unknown as ListingStore;
  const mirror: PostgresMirror = { upsertRecord: async () => {}, markDeleted: async () => {} };
  const store = createDualListingStore({
    primary, mirror, shadowReader: shadow as ListingStore, shadowReadTimeoutMs: opts.timeoutMs,
    onShadowRead: (report) => reports.push(report),
  });
  return { store, reports, record };
}

test('shadow read: identical results report a match and still return Airtable data', async () => {
  const { store, reports, record } = shadowSetup({ getRecords: async () => [{ ...record, fields: { Name: 'A', Empty: null } }] });
  assert.deepEqual(await store.getRecords('shopify-vendors'), [record]);
  assert.equal(reports[0].outcome, 'match');
});

test('shadow read: differing fields and missing rows report a mismatch with names only', async () => {
  const { store, reports, record } = shadowSetup({ getRecords: async () => [{ ...record, fields: { Name: 'B' } }, { ...record, id: 'rec2' }] });
  assert.deepEqual(await store.getRecords('shopify-vendors'), [record]);
  assert.equal(reports[0].outcome, 'mismatch');
  assert.deepEqual(reports[0].comparison?.fieldMismatches, [{ id: 'rec1', fields: ['Name'] }]);
  assert.deepEqual(reports[0].comparison?.extraInPostgres, ['rec2']);
});

test('shadow read: unsupported formula, errors and timeouts never affect the response', async () => {
  const unsupported = shadowSetup({ getRecords: async () => { throw Object.assign(new Error('x'), { code: 'POSTGRES_FORMULA_UNSUPPORTED' }); } });
  assert.equal((await unsupported.store.getRecords('shopify-vendors')).length, 1);
  assert.equal(unsupported.reports[0].outcome, 'unsupported');

  const failing = shadowSetup({ getRecords: async () => { throw new Error('db down'); } });
  assert.equal((await failing.store.getRecords('shopify-vendors')).length, 1);
  assert.equal(failing.reports[0].outcome, 'error');

  const slow = shadowSetup({ getRecords: () => new Promise(() => {}) }, { timeoutMs: 20 });
  assert.equal((await slow.store.getRecords('shopify-vendors')).length, 1);
  assert.equal(slow.reports[0].outcome, 'timeout');
});

test('shadow read: getRecord not found in Postgres is a mismatch', async () => {
  const { store, reports, record } = shadowSetup({ getRecord: async () => { throw Object.assign(new Error('nf'), { code: 'POSTGRES_RECORD_NOT_FOUND' }); } });
  assert.deepEqual(await store.getRecord('shopify-vendors', 'rec1'), record);
  assert.equal(reports[0].outcome, 'mismatch');
  assert.deepEqual(reports[0].comparison?.missingInPostgres, ['rec1']);
});
