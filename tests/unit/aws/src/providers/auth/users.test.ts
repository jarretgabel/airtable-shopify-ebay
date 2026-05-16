import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';
import { authUserDependencies, ensureSampleAuthUsers, updateAuthUserPassword, type AuthUserRecord } from '../../../../../../aws/src/providers/auth/users.js';

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
  const firstCall = calls[0];
  const secondCall = calls[1];
  assert.ok(firstCall);
  assert.ok(secondCall);
  assert.equal(firstCall.source, 'users');
  assert.equal(firstCall.recordId, 'rec123');
  assert.equal(firstCall.options.typecast, true);
  assert.equal('MustChangePassword' in firstCall.fields, true);
  assert.equal('Password' in firstCall.fields, true);
  assert.equal(secondCall.source, 'users');
  assert.equal(secondCall.recordId, 'rec123');
  assert.equal(secondCall.options.typecast, true);
  assert.equal('MustChangePassword' in secondCall.fields, false);
  assert.equal('Password' in secondCall.fields, true);
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

test('ensureSampleAuthUsers creates missing processor, tester, and photographer users', async () => {
  const originalCreate = authUserDependencies.createConfiguredRecord;
  const calls: Array<{ source: string; fields: Record<string, unknown>; options: { typecast?: boolean } }> = [];

  authUserDependencies.createConfiguredRecord = async (source, fields, options = {}) => {
    calls.push({ source, fields, options });
    return {
      id: `rec-${calls.length}`,
      fields,
      createdTime: new Date().toISOString(),
    };
  };

  try {
    await ensureSampleAuthUsers([{ ...baseUser, email: 'admin@example.com' }]);
  } finally {
    authUserDependencies.createConfiguredRecord = originalCreate;
  }

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((call) => call.source), ['users', 'users', 'users']);
  assert.deepEqual(calls.map((call) => call.fields['Email']), ['processor@example.com', 'tester@example.com', 'photographer@example.com']);
  assert.deepEqual(calls.map((call) => call.fields['Role']), ['processor', 'tester', 'photographer']);
  const firstCall = calls[0];
  assert.ok(firstCall);
  assert.equal(typeof firstCall.fields.Password, 'string');
  assert.equal(calls.every((call) => call.options.typecast === true), true);
});

test('ensureSampleAuthUsers skips sample accounts that already exist', async () => {
  const originalCreate = authUserDependencies.createConfiguredRecord;
  const originalUpdate = authUserDependencies.updateConfiguredRecord;
  let callCount = 0;
  let updateCount = 0;

  authUserDependencies.createConfiguredRecord = async () => {
    callCount += 1;
    return {
      id: 'rec-unused',
      fields: {},
      createdTime: new Date().toISOString(),
    };
  };
  authUserDependencies.updateConfiguredRecord = async () => {
    updateCount += 1;
    return {
      id: 'rec-unused',
      fields: {},
      createdTime: new Date().toISOString(),
    };
  };

  try {
    await ensureSampleAuthUsers([
      { ...baseUser, email: 'processor@example.com', role: 'processor', passwordState: { scheme: 'legacy', legacyPassword: 'Processor123!' }, mustChangePassword: false, allowedPages: ['dashboard', 'inventory', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'testing-queue', 'photography-queue', 'incoming-gear', 'testing', 'photos', 'market', 'imagelab'] },
      { ...baseUser, email: 'tester@example.com', role: 'tester', passwordState: { scheme: 'legacy', legacyPassword: 'Tester123!' }, mustChangePassword: false, allowedPages: ['dashboard', 'testing-queue', 'testing'] },
      { ...baseUser, email: 'photographer@example.com', role: 'photographer', passwordState: { scheme: 'legacy', legacyPassword: 'Photographer123!' }, mustChangePassword: false, allowedPages: ['dashboard', 'photography-queue', 'photos', 'imagelab'] },
    ]);
  } finally {
    authUserDependencies.createConfiguredRecord = originalCreate;
    authUserDependencies.updateConfiguredRecord = originalUpdate;
  }

  assert.equal(callCount, 0);
  assert.equal(updateCount, 0);
});

test('ensureSampleAuthUsers resyncs sample accounts with stale passwords', async () => {
  const originalCreate = authUserDependencies.createConfiguredRecord;
  const originalUpdate = authUserDependencies.updateConfiguredRecord;
  const updateCalls: Array<{ source: string; recordId: string; fields: Record<string, unknown> }> = [];

  authUserDependencies.createConfiguredRecord = async () => {
    throw new Error('create should not be called');
  };
  authUserDependencies.updateConfiguredRecord = async (source, recordId, fields) => {
    updateCalls.push({ source, recordId, fields });
    return {
      id: recordId,
      fields,
      createdTime: new Date().toISOString(),
    };
  };

  try {
    await ensureSampleAuthUsers([
      {
        ...baseUser,
        airtableRecordId: 'rec-processor',
        email: 'processor@example.com',
        role: 'processor',
        passwordState: { scheme: 'legacy', legacyPassword: 'Processor123!' },
        mustChangePassword: false,
        allowedPages: ['dashboard', 'inventory', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'testing-queue', 'photography-queue', 'incoming-gear', 'testing', 'photos', 'market', 'imagelab'],
      },
      { ...baseUser, airtableRecordId: 'rec-tester', email: 'tester@example.com', role: 'tester', passwordState: { scheme: 'legacy', legacyPassword: 'old-password' }, mustChangePassword: true, allowedPages: ['dashboard'] },
      {
        ...baseUser,
        airtableRecordId: 'rec-photographer',
        email: 'photographer@example.com',
        role: 'photographer',
        passwordState: { scheme: 'legacy', legacyPassword: 'Photographer123!' },
        mustChangePassword: false,
        allowedPages: ['dashboard', 'photography-queue', 'photos', 'imagelab'],
      },
    ]);
  } finally {
    authUserDependencies.createConfiguredRecord = originalCreate;
    authUserDependencies.updateConfiguredRecord = originalUpdate;
  }

  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0]?.source, 'users');
  assert.equal(updateCalls[0]?.recordId, 'rec-tester');
  assert.equal(updateCalls[0]?.fields['Email'], 'tester@example.com');
});