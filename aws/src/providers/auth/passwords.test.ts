import test from 'node:test';
import assert from 'node:assert/strict';
import { needsPasswordUpgrade, parseStoredPasswordField, serializePasswordField, verifyStoredPassword } from './passwords.js';

function encodeLegacyPassword(password: string, mustChangePassword?: boolean): string {
  return Buffer.from(`__LCC_PASSWORD__:${JSON.stringify({ password, mustChangePassword })}`, 'utf8').toString('base64');
}

test('serializePasswordField stores verifiable hashed payloads', () => {
  const serialized = serializePasswordField('TempPass!234', true);
  const parsed = parseStoredPasswordField(serialized);

  assert.equal(parsed.scheme, 'pbkdf2-sha256');
  assert.equal(parsed.mustChangePassword, true);
  assert.equal(verifyStoredPassword('TempPass!234', parsed), true);
  assert.equal(verifyStoredPassword('wrong-password', parsed), false);
  assert.equal(needsPasswordUpgrade(parsed), false);
});

test('parseStoredPasswordField preserves legacy payload compatibility', () => {
  const parsed = parseStoredPasswordField(encodeLegacyPassword('legacy-pass', true));

  assert.equal(parsed.scheme, 'legacy');
  assert.equal(parsed.legacyPassword, 'legacy-pass');
  assert.equal(parsed.mustChangePassword, true);
  assert.equal(verifyStoredPassword('legacy-pass', parsed), true);
  assert.equal(needsPasswordUpgrade(parsed), true);
});