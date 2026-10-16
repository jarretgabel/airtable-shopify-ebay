import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHash } from 'node:crypto';
import { createHandler } from '../../../../../../aws/src/handlers/ebay/receiveNotification.js';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';

const ENDPOINT = 'https://hooks.example.com/api/hooks/ebay/notifications';

function createEvent(method: 'GET' | 'POST', options: { query?: Record<string, string>; body?: string; headers?: Record<string, string> } = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0', routeKey: '$default', rawPath: '/api/hooks/ebay/notifications', rawQueryString: '',
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
    queryStringParameters: options.query,
    requestContext: {
      accountId: 'test', apiId: 'test', domainName: 'localhost', domainPrefix: 'localhost',
      http: { method, path: '/api/hooks/ebay/notifications', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'request', routeKey: '$default', stage: '$default', time: 'now', timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: options.body,
  } as APIGatewayProxyEventV2;
}

const order = JSON.stringify({
  metadata: { topic: 'ORDER_CONFIRMATION' },
  notification: { eventDate: '2026-10-16T10:00:00.000Z', data: { orderId: 'O-1' } },
});

function build(overrides: Parameters<typeof createHandler>[0] = {}) {
  const forwarded: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    getVerificationToken: () => 'v'.repeat(40),
    getEndpoint: () => ENDPOINT,
    verifySignature: async () => undefined,
    getOrderLineItems: async () => [{ legacyItemId: '1111', sku: 'SKU-1' }],
    processEvent: async (payload) => {
      forwarded.push(payload);
      return { statusCode: 200 };
    },
    ...overrides,
  });
  return { handler, forwarded };
}

test('GET answers the challenge with the documented hash', async () => {
  const { handler } = build();
  const result = await handler(createEvent('GET', { query: { challenge_code: 'abc' } })) as { statusCode: number; body: string };
  const expected = createHash('sha256').update('abc').update('v'.repeat(40)).update(ENDPOINT).digest('hex');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), { challengeResponse: expected });
});

test('GET without a challenge code or without a configured token is refused', async () => {
  const { handler } = build();
  assert.equal(((await handler(createEvent('GET'))) as { statusCode: number }).statusCode, 400);
  const unconfigured = build({ getVerificationToken: () => undefined }).handler;
  assert.equal(((await unconfigured(createEvent('GET', { query: { challenge_code: 'abc' } }))) as { statusCode: number }).statusCode, 503);
});

test('POST verifies the signature against the exact raw body before anything else runs', async () => {
  const seen: Array<{ header: string; body: string }> = [];
  const { handler, forwarded } = build({
    verifySignature: async (input) => { seen.push({ header: input.signatureHeader, body: input.rawBody }); },
  });
  const result = await handler(createEvent('POST', { body: order, headers: { 'x-ebay-signature': 'sig' } })) as { statusCode: number };
  assert.equal(result.statusCode, 200);
  assert.deepEqual(seen, [{ header: 'sig', body: order }]);
  assert.equal(forwarded.length, 1);
});

test('POST with an invalid signature is rejected and nothing is processed or looked up', async () => {
  let lookedUp = false;
  const { handler, forwarded } = build({
    verifySignature: async () => { throw new HttpError(401, 'bad', { service: 'ebay', code: 'EBAY_NOTIFICATION_SIGNATURE_INVALID' }); },
    getOrderLineItems: async () => { lookedUp = true; return []; },
  });
  const result = await handler(createEvent('POST', { body: order })) as { statusCode: number };
  assert.equal(result.statusCode, 401);
  assert.equal(lookedUp, false);
  assert.equal(forwarded.length, 0);
});

test('POST forwards sold events as order.created with the notification time and acknowledges ignored topics', async () => {
  const { handler, forwarded } = build();
  await handler(createEvent('POST', { body: order }));
  assert.deepEqual(forwarded, [{ eventType: 'order.created', listingId: '1111', sku: 'SKU-1', orderId: 'O-1', occurredAt: '2026-10-16T10:00:00.000Z' }]);

  const ignored = build();
  const result = await ignored.handler(createEvent('POST', { body: JSON.stringify({ metadata: { topic: 'ORDER_RETURN_ACTIVITY' }, notification: { data: { orderId: 'O-1' } } }) })) as { statusCode: number; body: string };
  assert.equal(result.statusCode, 200);
  assert.equal(JSON.parse(result.body).ignored, 'topic-not-mapped:ORDER_RETURN_ACTIVITY');
  assert.equal(ignored.forwarded.length, 0);
});

test('unmatched listings and permanent failures are acknowledged, retryable failures ask eBay to retry', async () => {
  const unmatched = build({ processEvent: async () => ({ statusCode: 404 }) });
  assert.equal(((await unmatched.handler(createEvent('POST', { body: order }))) as { statusCode: number }).statusCode, 200);

  const permanent = build({ processEvent: async () => ({ statusCode: 422 }) });
  assert.equal(((await permanent.handler(createEvent('POST', { body: order }))) as { statusCode: number }).statusCode, 200);

  const retry = build({ processEvent: async () => ({ statusCode: 503 }) });
  assert.equal(((await retry.handler(createEvent('POST', { body: order }))) as { statusCode: number }).statusCode, 503);

  const forbidden = build({ getOrderLineItems: async () => { throw new HttpError(403, 'Insufficient permissions', { service: 'ebay', code: 'EBAY_HTTP_ERROR' }); } });
  assert.equal(((await forbidden.handler(createEvent('POST', { body: order }))) as { statusCode: number }).statusCode, 503);

  const unknownOrder = build({ getOrderLineItems: async () => { throw new HttpError(404, 'No such order', { service: 'ebay', code: 'EBAY_HTTP_ERROR' }); } });
  const unknownResult = await unknownOrder.handler(createEvent('POST', { body: order })) as { statusCode: number; body: string };
  assert.equal(unknownResult.statusCode, 200);
  assert.equal(JSON.parse(unknownResult.body).lookupFailed, true);

  const lookupDown = build({ getOrderLineItems: async () => { throw new HttpError(503, 'down', { service: 'ebay', code: 'X', retryable: true }); } });
  assert.equal(((await lookupDown.handler(createEvent('POST', { body: order }))) as { statusCode: number }).statusCode, 503);
});

test('POST with a malformed JSON body is rejected after the signature check', async () => {
  const { handler } = build();
  assert.equal(((await handler(createEvent('POST', { body: '{nope' }))) as { statusCode: number }).statusCode, 400);
});
