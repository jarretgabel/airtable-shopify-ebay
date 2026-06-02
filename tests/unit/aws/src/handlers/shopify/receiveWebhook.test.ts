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

test('shopify webhook handler writes orders/paid event and persists order identifiers', async () => {
  let capturedSource: string | null = null;
  let capturedRecordId: string | null = null;
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-123',
        fields: {
          'Shopify Product ID': '9876543210',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (source, recordId, fields) => {
      capturedSource = source;
      capturedRecordId = recordId;
      capturedFields = fields;
      return { id: recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    order_id: 4700987949,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
    line_items: [{ product_id: 9876543210 }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedSource, 'used-gear-workflow');
  assert.equal(capturedRecordId, 'rec-123');
  assert.deepEqual(capturedFields, {
    'Shopify Order ID': '4700987949',
    'Shopify Order Name': '#1001',
    'Shopify Last Webhook Event ID': 'evt-123',
    'Shopify Last Webhook At': '2025-06-01T12:00:00Z',
    'Shopify Last Webhook Event': 'orders/paid',
  });
  assert.match(response.body || '', /"skipped":false/);
});

test('shopify webhook handler triggers cross-channel eBay close only for ORDERS_PAID', async () => {
  const closeCalls: Array<{ recordId: string; fields: Record<string, unknown> }> = [];

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-close',
        fields: {
          'Shopify Product ID': '9876543210',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, recordId, fields) => ({ id: recordId, createdTime: 'now', fields } as never),
    closeEbayListingWhenSoldOnShopify: async (recordId, fields) => {
      closeCalls.push({ recordId, fields });
      return { success: true, message: 'closed eBay listing' };
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    order_id: 4700987949,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
    line_items: [{ product_id: 9876543210 }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(closeCalls.length, 1);
  assert.equal(closeCalls[0]?.recordId, 'rec-close');
  assert.equal(closeCalls[0]?.fields['Shopify Order ID'], '4700987949');
});

test('shopify webhook handler writes ORDERS_CANCELLED outcome when not already set', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-456',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('orders-cancelled', 'orders/cancelled', {
    id: 4700987949,
    order_id: 4700987949,
    name: '#1001',
    cancelled_at: '2025-06-02T10:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Cancelled');
  assert.equal(capturedFields?.['Post-Sale Outcome At'], '2025-06-02T10:00:00Z');
});

test('shopify webhook handler writes REFUNDS_CREATE outcome when not already set', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-789',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 77,
    order_id: 4700987949,
    order_name: '#1001',
    created_at: '2025-06-02T11:00:00Z',
    note: 'Buyer reported transit damage',
    transactions: [{ amount: '29.99', status: 'success' }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Refunded');
  assert.equal(capturedFields?.['Post-Sale Outcome At'], '2025-06-02T11:00:00Z');
  assert.equal(capturedFields?.['Refund Amount'], 29.99);
  assert.equal(capturedFields?.['Refund Reason'], 'Buyer reported transit damage');
});

test('shopify refund webhook infers Partial Refund when refund amount is below Paid Amount', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-partial-refund',
        fields: {
          'Shopify Order ID': '4700987949',
          'Paid Amount': 150,
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 78,
    order_id: 4700987949,
    order_name: '#1002',
    created_at: '2025-06-02T11:15:00Z',
    transactions: [{ amount: '20', status: 'success' }],
    note: 'Partial price adjustment after delivery',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Partial Refund');
  assert.equal(capturedFields?.['Refund Amount'], 20);
  assert.equal(capturedFields?.['Refund Reason'], 'Partial price adjustment after delivery');
});

test('shopify refund webhook preserves manual refund fields when they already exist', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-manual-refund-fields',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
          'Refund Amount': 15,
          'Refund Reason': 'Manual staff note',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 79,
    order_id: 4700987949,
    order_name: '#1003',
    created_at: '2025-06-02T11:20:00Z',
    transactions: [{ amount: '29.99', status: 'success' }],
    note: 'Webhook refund reason',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Refund Amount'], undefined);
  assert.equal(capturedFields?.['Refund Reason'], undefined);
});

test('shopify webhook handler writes RETURNS_PROCESS as Returned when no outcome exists yet', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-returned',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
          'Return Received At': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('returns-process', 'returns/process', {
    id: 'gid://shopify/Return/123',
    name: 'R-1001',
    order: {
      id: 'gid://shopify/Order/4700987949',
    },
    status: 'processed',
    closed_at: '2026-06-02T12:30:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Returned');
  assert.equal(capturedFields?.['Post-Sale Outcome At'], '2026-06-02T12:30:00Z');
  assert.equal(capturedFields?.['Return Received At'], '2026-06-02T12:30:00Z');
  assert.equal(capturedFields?.['Shopify Last Webhook Event'], 'returns/process');
});

test('shopify dispute webhooks record notes without forcing a post-sale outcome', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-dispute',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
          'Post-Sale Notes': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('disputes-create', 'disputes/create', {
    id: 991,
    order: {
      id: 'gid://shopify/Order/4700987949',
    },
    type: 'chargeback',
    status: 'needs_response',
    reason: 'fraudulent',
    amount: '100.00',
    currency: 'USD',
    initiated_at: '2026-06-02T13:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], undefined);
  assert.equal(capturedFields?.['Post-Sale Notes'], 'Shopify dispute chargeback (needs_response) - fraudulent for 100.00 USD');
  assert.equal(capturedFields?.['Shopify Last Webhook Event'], 'disputes/create');
});

test('shopify webhook handler does not trigger cross-channel eBay close for refund webhooks', async () => {
  let closeCallCount = 0;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-refund',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, recordId, fields) => ({ id: recordId, createdTime: 'now', fields } as never),
    closeEbayListingWhenSoldOnShopify: async () => {
      closeCallCount += 1;
      return { success: true, message: 'should not run' };
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 77,
    order_id: 4700987949,
    order_name: '#1001',
    created_at: '2025-06-02T11:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(closeCallCount, 0);
});

test('shopify webhook handler does not overwrite existing Post-Sale Outcome (precedence)', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-precedence',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': 'Cancelled',
          'Post-Sale Outcome At': '2025-06-02T09:00:00Z',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 77,
    order_id: 4700987949,
    order_name: '#1001',
    created_at: '2025-06-02T11:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  // Outcome should NOT be overwritten
  assert.equal(capturedFields?.['Post-Sale Outcome'], undefined);
  assert.equal(capturedFields?.['Post-Sale Outcome At'], undefined);
  // Audit fields should still be updated
  assert.equal(capturedFields?.['Shopify Last Webhook Event'], 'refunds/create');
});

test('shopify webhook handler skips write when sync lock is enabled', async () => {
  let updateCalled = false;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-locked',
        fields: {
          'Shopify Product ID': '9876543210',
          'Shopify Sync Locked': true,
        },
      },
    ] as never),
    updateConfiguredRecord: async () => {
      updateCalled = true;
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    order_id: 4700987949,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
    line_items: [{ product_id: 9876543210 }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(updateCalled, false);
  assert.match(response.body || '', /"skipped":true/);
  assert.match(response.body || '', /"locked":true/);
});

test('shopify webhook handler skips duplicate event using idempotency key', async () => {
  let updateCalled = false;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-idempotent',
        fields: {
          'Shopify Product ID': '9876543210',
          'Shopify Last Webhook Event ID': 'evt-123',
        },
      },
    ] as never),
    updateConfiguredRecord: async () => {
      updateCalled = true;
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    order_id: 4700987949,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
    line_items: [{ product_id: 9876543210 }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(updateCalled, false);
  assert.match(response.body || '', /"skipped":true/);
  assert.match(response.body || '', /"idempotent":true/);
});

test('shopify webhook handler gracefully handles unmatched order (returns unmatched, not 404)', async () => {
  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-other',
        fields: {
          'Shopify Product ID': '1111111111',
        },
      },
    ] as never),
    updateConfiguredRecord: async () => {
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent('orders-paid', 'orders/paid', {
    id: 12345,
    order_id: 4700987949,
    name: '#1001',
    processed_at: '2025-06-01T12:00:00Z',
    line_items: [{ product_id: 9876543210 }],
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  // Should return 200 with unmatched flag, not 404, to prevent Shopify retry storms
  assert.equal(response.statusCode, 200);
  assert.match(response.body || '', /"skipped":true/);
  assert.match(response.body || '', /"unmatched":true/);
});

test('shopify webhook handler matches by fallback order ID when product ID not found', async () => {
  let capturedRecordId: string | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-fallback',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, recordId) => {
      capturedRecordId = recordId;
      return { id: recordId, createdTime: 'now', fields: {} } as never;
    },
  });

  const response = await handler(createEvent('refunds-create', 'refunds/create', {
    id: 77,
    order_id: 4700987949,
    order_name: '#1001',
    created_at: '2025-06-02T11:00:00Z',
    // No line_items: triggers fallback match by order ID
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(capturedRecordId, 'rec-fallback');
});

test('shopify webhook handler never writes Restock Disposition (relist block)', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => 'test-secret',
    getConfiguredRecords: async () => ([
      {
        id: 'rec-relist-guard',
        fields: {
          'Shopify Order ID': '4700987949',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent('orders-cancelled', 'orders/cancelled', {
    id: 4700987949,
    order_id: 4700987949,
    name: '#1001',
    cancelled_at: '2025-06-02T10:00:00Z',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  // Assert that Restock Disposition is NOT in the update fields
  assert.equal(capturedFields?.['Restock Disposition'], undefined);
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