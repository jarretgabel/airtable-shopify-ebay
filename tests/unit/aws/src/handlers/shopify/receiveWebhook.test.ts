import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/shopify/receiveWebhook.js';

function createEvent(topicPath: string, topicHeader: string, body: Record<string, unknown>, secret = 'test-secret'): APIGatewayProxyEventV2 {
  const rawBody = JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

  return {
    version: '2.0',
    routeKey: 'POST /api/hooks/shopify/{topic}',
    rawPath: `/api/hooks/shopify/${topicPath}`,
    rawQueryString: '',
    headers: {
      'content-type': 'application/json',
      'x-shopify-topic': topicHeader,
      'x-shopify-shop-domain': 'store.example.myshopify.com',
      'x-shopify-event-id': 'evt-123',
      'x-shopify-webhook-id': 'wh-123',
      'x-shopify-api-version': '2025-01',
      'x-shopify-hmac-sha256': signature,
    },
    pathParameters: { topic: topicPath },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: `/api/hooks/shopify/${topicPath}`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/hooks/shopify/{topic}',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: rawBody,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('shopify webhook handler accepts signed orders paid events and logs normalized output', async () => {
  const calls: unknown[] = [];
  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    logInfo: (_message, context) => {
      calls.push(context);
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.match(String(response.body), /"topic":"ORDERS_PAID"/);
  assert.match(String(response.body), /"orderId":"12345"/);
});

test('shopify webhook handler rejects invalid signatures', async () => {
  const handler = createHandler({
    getWebhookSecret: () => 'wrong-secret',
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', { id: 12345 }, 'test-secret'));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /signature is invalid/i);
});

test('shopify webhook handler rejects topic path mismatches', async () => {
  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
  });

  const response = await handler(createEvent('orders-paid', 'refunds/create', {
    id: 9,
    order_id: 12345,
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /does not match the callback path/i);
});

test('shopify webhook handler normalizes refund events with refund and order ids', async () => {
  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 77,
    order_id: 12345,
    order_name: '#1001',
    created_at: '2025-06-01T13:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.match(String(response.body), /"refundId":"77"/);
  assert.match(String(response.body), /"orderId":"12345"/);
});