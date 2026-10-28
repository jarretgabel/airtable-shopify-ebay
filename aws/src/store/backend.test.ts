import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../shared/errors.js';
import { resolveDataBackend } from './backend.js';
import { getListingStore } from './index.js';
import { airtableListingStore } from './airtableListingStore.js';

test('backend defaults to postgres when nothing is set', () => {
  assert.equal(resolveDataBackend('users', {}), 'postgres');
});

test('DATA_BACKEND sets the default for every source', () => {
  assert.equal(resolveDataBackend('users', { DATA_BACKEND: 'dual' }), 'dual');
});

test('DATA_BACKEND_OVERRIDES wins for the named source only', () => {
  const env = { DATA_BACKEND: 'airtable', DATA_BACKEND_OVERRIDES: 'shopify-vendors=postgres, users = dual' };
  assert.equal(resolveDataBackend('shopify-vendors', env), 'postgres');
  assert.equal(resolveDataBackend('users', env), 'dual');
  assert.equal(resolveDataBackend('user-guide', env), 'airtable');
});

test('postgres-read is a recognised backend', () => {
  assert.equal(resolveDataBackend('shopify-vendors', { DATA_BACKEND_OVERRIDES: 'shopify-vendors=postgres-read' }), 'postgres-read');
});

test('invalid backend values fail loudly instead of silently using airtable', () => {
  assert.throws(() => resolveDataBackend('users', { DATA_BACKEND: 'mongo' }), (error: unknown) => error instanceof HttpError && error.code === 'DATA_BACKEND_INVALID');
});

test('getListingStore returns the airtable store when DATA_BACKEND=airtable and a distinct store per backend', () => {
  const saved = { backend: process.env.DATA_BACKEND, overrides: process.env.DATA_BACKEND_OVERRIDES };
  try {
    process.env.DATA_BACKEND = 'airtable';
    delete process.env.DATA_BACKEND_OVERRIDES;
    assert.equal(getListingStore('users'), airtableListingStore);

    process.env.DATA_BACKEND_OVERRIDES = 'users=postgres';
    const first = getListingStore('users');
    assert.notEqual(first, airtableListingStore);
    assert.equal(getListingStore('users'), first);
    assert.equal(getListingStore('user-guide'), airtableListingStore);

    process.env.DATA_BACKEND_OVERRIDES = 'shopify-vendors=dual';
    const dual = getListingStore('shopify-vendors');
    assert.notEqual(dual, airtableListingStore);
    assert.equal(getListingStore('shopify-vendors'), dual);
    assert.equal(getListingStore('users'), airtableListingStore);
  } finally {
    if (saved.backend === undefined) delete process.env.DATA_BACKEND; else process.env.DATA_BACKEND = saved.backend;
    if (saved.overrides === undefined) delete process.env.DATA_BACKEND_OVERRIDES; else process.env.DATA_BACKEND_OVERRIDES = saved.overrides;
  }
});
