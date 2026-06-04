import test from 'node:test';
import assert from 'node:assert/strict';
import { needsPasswordUpgrade, parseStoredPasswordField, serializePasswordField, verifyStoredPassword } from '../../../../../../aws/src/providers/auth/passwords.js';

test('serializePasswordField stores verifiable hashed payloads', () => {
  const serialized = serializePasswordField('TempPass!234', true);
  const parsed = parseStoredPasswordField(serialized);

  assert.equal(parsed.scheme, 'pbkdf2-sha256');
  assert.equal(parsed.mustChangePassword, true);
  assert.equal(verifyStoredPassword('TempPass!234', parsed), true);
  assert.equal(verifyStoredPassword('wrong-password', parsed), false);
  assert.equal(needsPasswordUpgrade(parsed), false);
});

test('parseStoredPasswordField treats invalid payloads as needing upgrade', () => {
  const parsed = parseStoredPasswordField('not-a-password-payload');

  assert.equal(parsed.scheme, 'pbkdf2-sha256');
  assert.equal(verifyStoredPassword('any-password', parsed), false);
  assert.equal(needsPasswordUpgrade(parsed), true);
});