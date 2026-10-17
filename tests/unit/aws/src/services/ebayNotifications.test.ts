import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import {
  buildEbayNotificationEndpoint,
  computeEbayChallengeResponse,
  describePayloadShape,
  mapEbayNotification,
  verifyEbayNotificationSignature,
} from '../../../../../aws/src/services/ebayNotifications.js';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const publicKeyBody = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  .replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');

function sign(body: string, digest = 'SHA1', key = privateKey): string {
  const signature = createSign(digest).update(body).sign(key, 'base64');
  return Buffer.from(JSON.stringify({ alg: 'ecdsa', kid: 'kid-1', signature, digest })).toString('base64');
}

const body = JSON.stringify({ metadata: { topic: 'ORDER_CONFIRMATION' }, notification: { data: { orderId: '1' } } });
const getPublicKey = async () => ({ key: publicKeyBody, algorithm: 'ECDSA', digest: 'SHA1' });

test('challenge response hashes code, token and endpoint in eBay order', () => {
  const expected = createHash('sha256').update('code').update('token').update('https://x.test/hook').digest('hex');
  assert.equal(computeEbayChallengeResponse('code', 'token', 'https://x.test/hook'), expected);
  assert.notEqual(computeEbayChallengeResponse('token', 'code', 'https://x.test/hook'), expected);
});

test('accepts a correctly signed body', async () => {
  await verifyEbayNotificationSignature({ signatureHeader: sign(body), rawBody: body, getPublicKey });
});

test('rejects a tampered body, a wrong key, and malformed headers', async () => {
  const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const cases: Array<[string, string]> = [
    ['tampered body', body + ' '],
    ['wrong signer', body],
  ];
  await assert.rejects(
    verifyEbayNotificationSignature({ signatureHeader: sign(body), rawBody: cases[0][1], getPublicKey }),
    (error: { statusCode?: number; code?: string }) => error.statusCode === 401 && error.code === 'EBAY_NOTIFICATION_SIGNATURE_INVALID',
  );
  await assert.rejects(
    verifyEbayNotificationSignature({ signatureHeader: sign(body, 'SHA1', other.privateKey), rawBody: body, getPublicKey }),
    (error: { statusCode?: number }) => error.statusCode === 401,
  );
  for (const header of ['', 'not-base64-json', Buffer.from('{}').toString('base64'), Buffer.from(JSON.stringify({ kid: 'k' })).toString('base64')]) {
    await assert.rejects(
      verifyEbayNotificationSignature({ signatureHeader: header, rawBody: body, getPublicKey }),
      (error: { statusCode?: number }) => error.statusCode === 401,
    );
  }
});

test('rejects digests outside the allow-list and public-key failures stay retryable', async () => {
  await assert.rejects(
    verifyEbayNotificationSignature({
      signatureHeader: sign(body),
      rawBody: body,
      getPublicKey: async () => ({ key: publicKeyBody, digest: 'MD5' }),
    }),
    (error: { statusCode?: number }) => error.statusCode === 401,
  );

  const failure = Object.assign(new Error('eBay down'), { statusCode: 503 });
  await assert.rejects(
    verifyEbayNotificationSignature({ signatureHeader: sign(body), rawBody: body, getPublicKey: async () => { throw failure; } }),
    (error: unknown) => error === failure,
  );
});

test('maps ORDER_CONFIRMATION to one order.created event per line item', async () => {
  const lookups: string[] = [];
  const result = await mapEbayNotification(
    {
      metadata: { topic: 'ORDER_CONFIRMATION' },
      notification: { notificationId: 'n-1', eventDate: '2026-10-16T10:00:00.000Z', data: { orderId: '12-34567-89012' } },
    },
    {
      getOrderLineItems: async (orderId) => {
        lookups.push(orderId);
        return [{ legacyItemId: '1111', sku: 'SKU-1' }, { legacyItemId: '2222', sku: '' }];
      },
    },
  );

  assert.deepEqual(lookups, ['12-34567-89012']);
  assert.deepEqual(result, {
    kind: 'events',
    events: [
      { eventType: 'order.created', listingId: '1111', sku: 'SKU-1', orderId: '12-34567-89012', occurredAt: '2026-10-16T10:00:00.000Z' },
      { eventType: 'order.created', listingId: '2222', sku: '', orderId: '12-34567-89012', occurredAt: '2026-10-16T10:00:00.000Z' },
    ],
  });
});

test('ignores unmapped topics, missing order ids and empty orders without looking anything up', async () => {
  const deps = { getOrderLineItems: async () => { throw new Error('must not be called'); } };
  assert.deepEqual(
    await mapEbayNotification({ metadata: { topic: 'ORDER_RETURN_ACTIVITY' }, notification: { data: { orderId: '1' } } }, deps),
    { kind: 'ignored', reason: 'topic-not-mapped:ORDER_RETURN_ACTIVITY' },
  );
  assert.deepEqual(
    await mapEbayNotification({ metadata: { topic: 'ORDER_CONFIRMATION' }, notification: { data: {} } }, deps),
    { kind: 'ignored', reason: 'order-id-missing' },
  );
  assert.deepEqual(
    await mapEbayNotification({}, deps),
    { kind: 'ignored', reason: 'topic-missing' },
  );
  assert.deepEqual(
    await mapEbayNotification({ metadata: { topic: 'ORDER_CONFIRMATION' }, notification: { data: { orderId: '1' } } }, { getOrderLineItems: async () => [{ legacyItemId: '', sku: '' }] }),
    { kind: 'ignored', reason: 'order-has-no-listing-identifiers' },
  );
});

test('payload shape lists key paths only and never values', () => {
  const shape = describePayloadShape({ orderId: 'SECRET-1', buyer: { name: 'Jane Doe', tags: ['x'] }, items: [{ sku: 'S' }], empty: {} });
  assert.deepEqual(shape, ['buyer.name', 'buyer.tags[]', 'empty', 'items[].sku', 'orderId']);
  assert.ok(!JSON.stringify(shape).includes('SECRET') && !JSON.stringify(shape).includes('Jane'));
});

test('the endpoint is the same whether or not the base URL already ends in /api or a slash', () => {
  const expected = 'https://d.example.com/api/hooks/ebay/notifications';
  for (const base of ['https://d.example.com', 'https://d.example.com/', 'https://d.example.com/api', ' https://d.example.com/api/ ']) {
    assert.equal(buildEbayNotificationEndpoint(base), expected, base);
  }
  assert.equal(buildEbayNotificationEndpoint(''), '');
});

test('maps the real eBay ORDER_CONFIRMATION shape (data.order with its own line items) without an order lookup', async () => {
  const result = await mapEbayNotification(
    {
      metadata: { topic: 'ORDER_CONFIRMATION' },
      notification: {
        notificationId: 'n-2',
        eventDate: '2026-10-17T22:11:28.000Z',
        data: { order: { orderId: '12-34567-89012', orderLineItems: [{ listingId: '1111', orderLineItemId: 'li-1', quantity: 1 }, { listingId: '2222', quantity: 2 }] } },
      },
    },
    { getOrderLineItems: async () => { throw new Error('must not be called'); } },
  );

  assert.deepEqual(result, {
    kind: 'events',
    events: [
      { eventType: 'order.created', listingId: '1111', sku: '', orderId: '12-34567-89012', occurredAt: '2026-10-17T22:11:28.000Z' },
      { eventType: 'order.created', listingId: '2222', sku: '', orderId: '12-34567-89012', occurredAt: '2026-10-17T22:11:28.000Z' },
    ],
  });
});

test('falls back to the order lookup when the real shape carries an order id but no line items', async () => {
  const result = await mapEbayNotification(
    { metadata: { topic: 'ORDER_CONFIRMATION' }, notification: { eventDate: 't', data: { order: { orderId: 'O-9' } } } },
    { getOrderLineItems: async (orderId) => [{ legacyItemId: '3333', sku: 'S-3' }].map((item) => ({ ...item, orderId })) },
  );
  assert.deepEqual(result, { kind: 'events', events: [{ eventType: 'order.created', listingId: '3333', sku: 'S-3', orderId: 'O-9', occurredAt: 't' }] });
});
