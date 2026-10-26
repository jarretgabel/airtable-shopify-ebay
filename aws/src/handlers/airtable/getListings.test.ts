import assert from 'node:assert/strict';
import test from 'node:test';
import { servedFromPostgres } from './getListings.js';

test('legacy listings read uses Postgres only when a directory source is off Airtable', () => {
  const saved = { ...process.env };
  try {
    process.env.DATA_BACKEND_OVERRIDES = 'inventory-directory=airtable,approval-ebay=airtable';
    assert.equal(servedFromPostgres(), false);
    process.env.DATA_BACKEND_OVERRIDES = 'inventory-directory=postgres,approval-ebay=airtable';
    assert.equal(servedFromPostgres(), true);
  } finally {
    process.env = saved;
  }
});
