import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../shared/errors.js';
import { authUserDependencies, updateAuthUserPassword, type AuthUserRecord } from './users.js';

const baseUser: AuthUserRecord = {
  id: 'user-1',
  airtableRecordId: 'rec123',
  email: 'admin@example.com',
  role: 'admin',
  passwordState: {
    scheme: 'legacy',
    legacyPassword: 'legacy-pass',
  },
  mustChangePassword: true,
  allowedPages: [],
};

test('updateAuthUserPassword retries without MustChangePassword when Airtable schema omits that field', async () => {
  const calls: Array<{ source: string; recordId: string; fields: Record<string, unknown>; options: { typecast?: boolean } }> = [];
  const original = authUserDependencies.updateConfiguredRecord;

  authUserDependencies.updateConfiguredRecord = async (source, recordId, fields, options = {}) => {
    calls.push({ source, recordId, fields, options });

    if (calls.length === 1) {
      throw new HttpError(422, 'Unknown field name: "MustChangePassword"', {
        service: 'airtable',
        code: 'AIRTABLE_HTTP_ERROR',
        retryable: false,
      });
    }

    return {
      id: recordId,
      fields,
      createdTime: new Date().toISOString(),
    };
  };

  try {
    await updateAuthUserPassword(baseUser, 'NextPassword!123', true);
  } finally {
    authUserDependencies.updateConfiguredRecord = original;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.source, 'users');
  assert.equal(calls[0]?.recordId, 'rec123');
  assert.equal(calls[0]?.options.typecast, true);
  assert.equal('MustChangePassword' in calls[0]?.fields, true);
  assert.equal('Password' in calls[0]?.fields, true);
  assert.equal(calls[1]?.source, 'users');
  assert.equal(calls[1]?.recordId, 'rec123');
  assert.equal(calls[1]?.options.typecast, true);
  assert.equal('MustChangePassword' in calls[1]?.fields, false);
  assert.equal('Password' in calls[1]?.fields, true);
});

test('updateAuthUserPassword rethrows unrelated Airtable write errors', async () => {
  const original = authUserDependencies.updateConfiguredRecord;

  authUserDependencies.updateConfiguredRecord = async () => {
    throw new HttpError(422, 'Unknown field name: "Password"', {
      service: 'airtable',
      code: 'AIRTABLE_HTTP_ERROR',
      retryable: false,
    });
  };

  try {
    await assert.rejects(
      updateAuthUserPassword(baseUser, 'NextPassword!123', true),
      (error: unknown) => error instanceof HttpError && error.message === 'Unknown field name: "Password"',
    );
  } finally {
    authUserDependencies.updateConfiguredRecord = original;
  }
});