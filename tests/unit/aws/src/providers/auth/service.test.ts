import test from 'node:test';
import assert from 'node:assert/strict';
import { authServiceDependencies, resolveSession } from '../../../../../../aws/src/providers/auth/service.js';
import { issueSessionToken } from '../../../../../../aws/src/providers/auth/tokens.js';
import type { AuthUserRecord } from '../../../../../../aws/src/providers/auth/users.js';

process.env.APP_AUTH_TOKEN_SECRET = process.env.APP_AUTH_TOKEN_SECRET || 'test-secret-for-auth-tests';

const baseUser: AuthUserRecord = {
  id: 'u-dev',
  airtableRecordId: 'rec-dev',
  name: 'Devon Developer',
  email: 'developer@example.com',
  role: 'developer',
  passwordState: {
    scheme: 'pbkdf2-sha256',
    salt: 'test-salt',
    hash: 'test-hash',
    iterations: 210000,
  },
  mustChangePassword: false,
  allowedPages: ['dashboard', 'inventory'],
};

test('resolveSession uses embedded claims without Airtable for successive auth checks', async () => {
  const originalFindById = authServiceDependencies.findAuthUserById;
  let lookupCount = 0;

  authServiceDependencies.findAuthUserById = async () => {
    lookupCount += 1;
    return baseUser;
  };

  try {
    const token = issueSessionToken({
      userId: baseUser.id,
      airtableRecordId: baseUser.airtableRecordId,
      name: baseUser.name,
      email: baseUser.email,
      mustChangePassword: baseUser.mustChangePassword,
      role: baseUser.role,
      allowedPages: baseUser.allowedPages,
    });

    const session = await resolveSession(token);

    assert.deepEqual(session, {
      userId: baseUser.id,
      airtableRecordId: baseUser.airtableRecordId,
      name: baseUser.name,
      email: baseUser.email,
      mustChangePassword: baseUser.mustChangePassword,
      role: baseUser.role,
      allowedPages: baseUser.allowedPages,
    });
  } finally {
    authServiceDependencies.findAuthUserById = originalFindById;
  }

  assert.equal(lookupCount, 0);
});

test('resolveSession rejects tokens without embedded claims', async () => {
  await assert.rejects(async () => {
    await resolveSession(issueSessionToken(baseUser.id, baseUser.mustChangePassword));
  }, (error: unknown) => {
    return error instanceof Error && error.message.includes('Session is invalid.');
  });
});
