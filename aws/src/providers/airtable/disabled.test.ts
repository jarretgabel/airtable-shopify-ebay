import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableMetadata, isAirtableDisabled } from './client.js';
import { HttpError } from '../../shared/errors.js';

test('isAirtableDisabled only accepts true', () => {
  assert.equal(isAirtableDisabled({ AIRTABLE_DISABLED: 'true' }), true);
  assert.equal(isAirtableDisabled({ AIRTABLE_DISABLED: ' TRUE ' }), true);
  assert.equal(isAirtableDisabled({ AIRTABLE_DISABLED: 'false' }), false);
  assert.equal(isAirtableDisabled({}), false);
});

test('a disabled Airtable client fails with 503 before any network call', async () => {
  const saved = { disabled: process.env.AIRTABLE_DISABLED, key: process.env.AIRTABLE_API_KEY, fetch: globalThis.fetch };
  process.env.AIRTABLE_DISABLED = 'true';
  process.env.AIRTABLE_API_KEY = 'test-key';
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response('{}'); }) as typeof fetch;
  try {
    await assert.rejects(
      () => getTableMetadata('appTEST', 'tblTEST'),
      (error: unknown) => error instanceof HttpError && error.code === 'AIRTABLE_DISABLED' && error.statusCode === 503,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = saved.fetch;
    if (saved.disabled === undefined) delete process.env.AIRTABLE_DISABLED; else process.env.AIRTABLE_DISABLED = saved.disabled;
    if (saved.key === undefined) delete process.env.AIRTABLE_API_KEY; else process.env.AIRTABLE_API_KEY = saved.key;
  }
});
