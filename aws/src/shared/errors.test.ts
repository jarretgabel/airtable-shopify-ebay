import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, getStatusCode, toApiErrorBody } from './errors.js';

test('toApiErrorBody preserves HttpError details', () => {
  const error = new HttpError(422, 'Invalid request', {
    service: 'airtable',
    code: 'INVALID_REQUEST',
    retryable: false,
  });

  assert.deepEqual(toApiErrorBody('airtable', error, 'FALLBACK_CODE'), {
    message: 'Invalid request',
    service: 'airtable',
    code: 'INVALID_REQUEST',
    retryable: false,
  });
  assert.equal(getStatusCode(error), 422);
});

test('toApiErrorBody normalizes unknown errors to fallback values', () => {
  const error = new Error('boom');

  assert.deepEqual(toApiErrorBody('shopify', error, 'SHOPIFY_FAILED'), {
    message: 'boom',
    service: 'shopify',
    code: 'SHOPIFY_FAILED',
    retryable: true,
  });
  assert.equal(getStatusCode(error, 503), 503);
});