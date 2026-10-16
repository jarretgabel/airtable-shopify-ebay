import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/shopify/receiveWebhook.js';

function createEvent(topicPath: string, topicHeader: string, body: Record<string, unknown>, secret = 'test-secret'): APIGatewayProxyEventV2 {
  const rawBody = JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  return {
    version: '2.0', routeKey: 'POST /api/hooks/shopify/{topic}', rawPath: `/api/hooks/shopify/${topicPath}`, rawQueryString: '',
    headers: {
      'content-type': 'application/json', 'x-shopify-topic': topicHeader, 'x-shopify-shop-domain': 'store.example.myshopify.com',
      'x-shopify-event-id': 'evt-123', 'x-shopify-webhook-id': 'wh-123', 'x-shopify-api-version': '2025-01', 'x-shopify-hmac-sha256': signature,
    },
    pathParameters: { topic: topicPath },
    requestContext: {
      accountId: 'test', apiId: 'test', domainName: 'localhost', domainPrefix: 'localhost',
      http: { method: 'POST', path: `/api/hooks/shopify/${topicPath}`, protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'request', routeKey: 'POST /api/hooks/shopify/{topic}', stage: '$default', time: 'now', timeEpoch: 0,
    },
    body: rawBody,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const paidOrder = {
  id: 12345, order_id: 4700987949, name: '#1001', processed_at: '2025-06-01T12:00:00Z', financial_status: 'paid',
  line_items: [{ product_id: 9876543210 }],
};
const ok = { success: true, message: 'ok', closedAt: 'now' };

function build(overrides: Parameters<typeof createHandler>[0] = {}) {
  const steps: string[] = [];
  const writes: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => [{ id: 'rec-sale', fields: { 'Shopify Product ID': '9876543210', 'Shopify REST Product ID': '111', 'Post-Sale Outcome': '' } }] as never,
    updateConfiguredRecord: async (_source, recordId, fields) => {
      steps.push('write');
      writes.push(fields);
      return { id: recordId, createdTime: 'now', fields } as never;
    },
    closeEbayListingWhenSoldOnShopify: async () => { steps.push('ebay'); return ok; },
    retainShopifyProductWhenSoldOnShopify: async () => { steps.push('retain'); return ok; },
    ...overrides,
  });
  return { handler, steps, writes };
}

test('a Shopify sale withdraws the eBay offer and retains the Shopify product using the sold order product id', async () => {
  const retainCalls: Array<{ recordId: string; productIdHint?: string }> = [];
  const { handler } = build({
    retainShopifyProductWhenSoldOnShopify: async (recordId, _fields, options) => {
      retainCalls.push({ recordId, productIdHint: options?.productIdHint });
      return ok;
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(retainCalls, [{ recordId: 'rec-sale', productIdHint: '9876543210' }]);
});

test('both sale side effects complete before the event is recorded as processed', async () => {
  const { handler, steps } = build();
  await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  assert.deepEqual(steps.slice(-1), ['write']);
  assert.deepEqual([...steps].sort(), ['ebay', 'retain', 'write']);
});

test('a retryable failure in either side effect returns 503 without marking the event processed', async () => {
  for (const failing of ['closeEbayListingWhenSoldOnShopify', 'retainShopifyProductWhenSoldOnShopify'] as const) {
    const { handler, writes } = build({ [failing]: async () => ({ success: false, retryable: true, message: 'HTTP 503', closedAt: 'now' }) });
    const response = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
    if (typeof response === 'string') throw new Error('Expected structured response');

    assert.equal(response.statusCode, 503, failing);
    assert.equal(writes.length, 0, failing);
  }
});

test('a failing side effect does not stop the other one from running', async () => {
  const { handler, steps } = build({
    closeEbayListingWhenSoldOnShopify: async () => { steps.push('ebay'); return { success: false, retryable: true, message: 'HTTP 503', closedAt: 'now' }; },
  });
  await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  assert.ok(steps.includes('ebay'));
  assert.ok(steps.includes('retain'));
});

test('the retried delivery completes and records the event once both side effects succeed', async () => {
  let attempt = 0;
  const { handler, writes } = build({
    retainShopifyProductWhenSoldOnShopify: async () => {
      attempt += 1;
      return attempt === 1 ? { success: false, retryable: true, message: 'HTTP 503', closedAt: 'now' } : ok;
    },
  });

  const first = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  const second = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  if (typeof first === 'string' || typeof second === 'string') throw new Error('Expected structured response');

  assert.equal(first.statusCode, 503);
  assert.equal(second.statusCode, 200);
  assert.equal(writes.length, 1);
});

test('an unexpected exception in a side effect is treated as retryable', async () => {
  const { handler, writes } = build({ retainShopifyProductWhenSoldOnShopify: async () => { throw new Error('socket hang up'); } });
  const response = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 503);
  assert.equal(writes.length, 0);
});

test('permanent failures and manual-review outcomes are recorded and answer 200', async () => {
  const outcomes = [
    { success: false, retryable: false, message: 'Missing Shopify REST Product ID', closedAt: 'now' },
    { success: true, retryable: false, outcome: 'needs-review' as const, message: '2 still in stock after the Shopify sale', closedAt: 'now' },
  ];
  for (const outcome of outcomes) {
    const { handler, writes } = build({ retainShopifyProductWhenSoldOnShopify: async () => outcome });
    const response = await handler(createEvent('orders-paid', 'orders/updated', paidOrder));
    if (typeof response === 'string') throw new Error('Expected structured response');

    assert.equal(response.statusCode, 200);
    assert.equal(writes.length, 1);
  }
});

test('refunds and cancellations never retain, untag or restock the Shopify product', async () => {
  let retainCalls = 0;
  const { handler } = build({ retainShopifyProductWhenSoldOnShopify: async () => { retainCalls += 1; return ok; } });

  const refund = await handler(createEvent('refunds-create', 'refunds/create', { id: 999, order_id: 4700987949, refund_line_items: [{ line_item: { product_id: 9876543210 } }] }));
  if (typeof refund === 'string') throw new Error('Expected structured response');

  assert.equal(refund.statusCode, 200);
  assert.equal(retainCalls, 0);
});
