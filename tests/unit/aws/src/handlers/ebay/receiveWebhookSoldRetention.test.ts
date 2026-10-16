import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/ebay/receiveWebhook.js';

function createEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0', routeKey: '$default', rawPath: '/api/hooks/ebay/listings', rawQueryString: '',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test', apiId: 'test', domainName: 'localhost', domainPrefix: 'localhost',
      http: { method: 'POST', path: '/api/hooks/ebay/listings', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'request', routeKey: '$default', stage: '$default', time: 'now', timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: JSON.stringify(body),
  } as APIGatewayProxyEventV2;
}

const saleEvent = { eventType: 'order.created', listingId: '1111111111', sku: 'SKU-11', occurredAt: '2026-06-02T11:00:00.000Z' };
const record = { id: 'rec-sale', fields: { SKU: 'SKU-11', 'eBay Listing ID': '1111111111', 'Shopify REST Product ID': '15430268879170' } };

function build(overrides: Parameters<typeof createHandler>[0] = {}) {
  const steps: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => [record] as never,
    updateConfiguredRecord: async (_source, recordId, fields) => {
      steps.push('write');
      writes.push(fields);
      return { id: recordId, createdTime: 'now', fields } as never;
    },
    retainShopifyProductWhenSoldOnEbay: async () => {
      steps.push('retain');
      return { success: true, message: 'Shopify product retained (stock 0, tagged sold-archive)', closedAt: 'now' };
    },
    ...overrides,
  });
  return { handler, steps, writes };
}

test('an eBay sale retains the Shopify product (never deletes it) with the record merged with the sale event', async () => {
  const calls: Array<{ recordId: string; fields: Record<string, unknown> }> = [];
  const { handler } = build({
    retainShopifyProductWhenSoldOnEbay: async (recordId, fields) => {
      calls.push({ recordId, fields });
      return { success: true, message: 'retained', closedAt: 'now' };
    },
  });

  const response = await handler(createEvent(saleEvent));

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].recordId, 'rec-sale');
  assert.equal(calls[0].fields['Shopify REST Product ID'], '15430268879170');
  assert.equal(calls[0].fields['eBay Last Webhook Event'], 'order.created');
});

test('retention completes before the event is recorded as processed', async () => {
  const { handler, steps } = build();
  await handler(createEvent(saleEvent));
  assert.deepEqual(steps, ['retain', 'write']);
});

test('a retryable retention failure returns 503 and does not mark the event processed, so the retry is not skipped', async () => {
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnEbay: async () => ({ success: false, retryable: true, message: 'Shopify sold-retention error: HTTP 503', closedAt: 'now' }),
  });

  const response = await handler(createEvent(saleEvent));

  assert.equal(response.statusCode, 503);
  assert.match(String((response as { body?: string }).body), /"retryable":true/);
  assert.equal(writes.length, 0);
});

test('the retried delivery succeeds and is then recorded once the failure clears', async () => {
  let attempt = 0;
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnEbay: async () => {
      attempt += 1;
      return attempt === 1
        ? { success: false, retryable: true, message: 'HTTP 503', closedAt: 'now' }
        : { success: true, message: 'retained', closedAt: 'now' };
    },
  });

  assert.equal((await handler(createEvent(saleEvent))).statusCode, 503);
  assert.equal((await handler(createEvent(saleEvent))).statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]['eBay Last Webhook Event'], 'order.created');
});

test('an unexpected exception during retention is treated as retryable', async () => {
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnEbay: async () => { throw new Error('socket hang up'); },
  });

  const response = await handler(createEvent(saleEvent));

  assert.equal(response.statusCode, 503);
  assert.equal(writes.length, 0);
});

test('a permanent retention failure is recorded and answers 200 so the platform does not retry forever', async () => {
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnEbay: async () => ({ success: false, retryable: false, message: 'Missing Shopify REST Product ID', closedAt: 'now' }),
  });

  const response = await handler(createEvent(saleEvent));

  assert.equal(response.statusCode, 200);
  assert.equal(writes.length, 1);
});

test('a product flagged for manual review still records the sale and answers 200', async () => {
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnEbay: async () => ({ success: true, retryable: false, outcome: 'needs-review', message: 'Multi-unit product (3 in stock) left unchanged', closedAt: 'now' }),
  });

  assert.equal((await handler(createEvent(saleEvent))).statusCode, 200);
  assert.equal(writes.length, 1);
});

test('cancel and refund events never retain, restock or untag anything', async () => {
  let retainCalls = 0;
  const { handler } = build({
    retainShopifyProductWhenSoldOnEbay: async () => { retainCalls += 1; return { success: true, message: 'x', closedAt: 'now' }; },
  });

  for (const eventType of ['order.cancelled', 'order.refunded']) {
    assert.equal((await handler(createEvent({ ...saleEvent, eventType, occurredAt: `2026-06-02T11:3${eventType.length % 9}:00.000Z` }))).statusCode, 200);
  }
  assert.equal(retainCalls, 0);
});
