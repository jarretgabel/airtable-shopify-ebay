import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsrfToken } from './csrf.js';

test('buildCsrfToken changes when the CSRF secret changes', () => {
  const originalTokenSecret = process.env.APP_AUTH_TOKEN_SECRET;
  const originalCsrfSecret = process.env.APP_AUTH_CSRF_SECRET;

  try {
    process.env.APP_AUTH_TOKEN_SECRET = 'csrf-secret-one';
    delete process.env.APP_AUTH_CSRF_SECRET;
    const firstToken = buildCsrfToken('session-token-value');

    process.env.APP_AUTH_TOKEN_SECRET = 'csrf-secret-two';
    const secondToken = buildCsrfToken('session-token-value');

    assert.notEqual(firstToken, secondToken);
  } finally {
    if (originalTokenSecret === undefined) {
      delete process.env.APP_AUTH_TOKEN_SECRET;
    } else {
      process.env.APP_AUTH_TOKEN_SECRET = originalTokenSecret;
    }

    if (originalCsrfSecret === undefined) {
      delete process.env.APP_AUTH_CSRF_SECRET;
    } else {
      process.env.APP_AUTH_CSRF_SECRET = originalCsrfSecret;
    }
  }
});
