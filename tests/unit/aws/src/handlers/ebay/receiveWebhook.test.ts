import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/ebay/receiveWebhook.js';

function createEvent(body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/api/hooks/ebay/listings',
    rawQueryString: '',
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/hooks/ebay/listings',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: '$default',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    body: JSON.stringify(body),
  } as APIGatewayProxyEventV2;
}

test('updates the matched used-gear record when the webhook arrives unlocked', async () => {
  let capturedSource: string | null = null;
  let capturedRecordId: string | null = null;
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-123',
        fields: {
          SKU: 'SKU-1',
          'eBay Listing ID': '1234567890',
          'eBay Offer ID': 'OFF-1',
          'eBay Sync Locked': false,
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

  const response = await handler(createEvent({
    eventType: 'listing.updated',
    listingId: '1234567890',
    offerId: 'OFF-1',
    sku: 'SKU-1',
    status: 'published',
    occurredAt: '2026-06-02T12:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(capturedSource, 'used-gear-workflow');
  assert.equal(capturedRecordId, 'rec-123');
  assert.deepEqual(capturedFields, {
    'eBay Listing ID': '1234567890',
    'eBay Offer ID': 'OFF-1',
    'eBay Offer Status': 'PUBLISHED',
    'eBay Listing Status': 'PUBLISHED',
    'eBay Last Webhook At': '2026-06-02T12:00:00.000Z',
    'eBay Last Webhook Event': 'listing.updated',
  });
});

test('skips automatic updates when the eBay sync lock is enabled', async () => {
  let updateCalled = false;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-456',
        fields: {
          SKU: 'SKU-2',
          'eBay Listing ID': '2222222222',
          'eBay Sync Locked': 'yes',
        },
      },
    ] as never),
    updateConfiguredRecord: async () => {
      updateCalled = true;
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent({
    listingId: '2222222222',
    sku: 'SKU-2',
    status: 'ended',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(updateCalled, false);
  assert.match(response.body || '', /"skipped":true/);
  assert.match(response.body || '', /"locked":true/);
});

test('skips duplicate webhook events using timestamp+eventType dedup guard', async () => {
  let updateCalled = false;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-dedup',
        fields: {
          SKU: 'SKU-3',
          'eBay Listing ID': '3333333333',
          'eBay Last Webhook Event': 'order.cancelled',
          'eBay Last Webhook At': '2026-06-02T10:00:00.000Z',
        },
      },
    ] as never),
    updateConfiguredRecord: async () => {
      updateCalled = true;
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.cancelled',
    listingId: '3333333333',
    sku: 'SKU-3',
    occurredAt: '2026-06-02T10:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(updateCalled, false);
  assert.match(response.body || '', /"skipped":true/);
  assert.match(response.body || '', /"deduped":true/);
});

test('writes order.cancelled post-sale outcome when not already set', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-order-cancelled',
        fields: {
          SKU: 'SKU-4',
          'eBay Listing ID': '4444444444',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.cancelled',
    listingId: '4444444444',
    sku: 'SKU-4',
    occurredAt: '2026-06-02T10:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Cancelled');
  assert.equal(capturedFields?.['Post-Sale Outcome At'], '2026-06-02T10:00:00.000Z');
  assert.equal(capturedFields?.['eBay Last Webhook Event'], 'order.cancelled');
});

test('writes order.refunded post-sale outcome when not already set', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-order-refunded',
        fields: {
          SKU: 'SKU-5',
          'eBay Listing ID': '5555555555',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.refunded',
    listingId: '5555555555',
    sku: 'SKU-5',
    occurredAt: '2026-06-02T11:00:00.000Z',
    refundAmount: '42.50',
    refundReason: 'Transit damage',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Refunded');
  assert.equal(capturedFields?.['Post-Sale Outcome At'], '2026-06-02T11:00:00.000Z');
  assert.equal(capturedFields?.['Refund Amount'], 42.5);
  assert.equal(capturedFields?.['Refund Reason'], 'Transit damage');
});

test('infers Partial Refund for eBay refund events when refund amount is below Paid Amount', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-ebay-partial',
        fields: {
          SKU: 'SKU-9',
          'eBay Listing ID': '9999999999',
          'Paid Amount': 100,
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.refunded',
    listingId: '9999999999',
    sku: 'SKU-9',
    occurredAt: '2026-06-02T11:10:00.000Z',
    refundAmount: '15',
    refundReason: 'Partial goodwill adjustment',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Post-Sale Outcome'], 'Partial Refund');
  assert.equal(capturedFields?.['Refund Amount'], 15);
  assert.equal(capturedFields?.['Refund Reason'], 'Partial goodwill adjustment');
});

test('preserves manual refund fields when eBay refund details already exist', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-ebay-manual-fields',
        fields: {
          SKU: 'SKU-10',
          'eBay Listing ID': '1010101010',
          'Post-Sale Outcome': '',
          'Refund Amount': 9,
          'Refund Reason': 'Manual override',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.refunded',
    listingId: '1010101010',
    sku: 'SKU-10',
    occurredAt: '2026-06-02T11:12:00.000Z',
    refundAmount: '12',
    refundReason: 'Webhook reason',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFields?.['Refund Amount'], undefined);
  assert.equal(capturedFields?.['Refund Reason'], undefined);
});

test('triggers cross-channel Shopify close for sale-confirming eBay order events', async () => {
  const closeCalls: Array<{ recordId: string; fields: Record<string, unknown> }> = [];

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-cross-channel',
        fields: {
          SKU: 'SKU-11',
          'eBay Listing ID': '1111111111',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, recordId, fields) => ({ id: recordId, createdTime: 'now', fields } as never),
    closeShopifyProductWhenSoldOnEbay: async (recordId, fields) => {
      closeCalls.push({ recordId, fields });
      return { success: true, message: 'closed Shopify product' };
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.created',
    listingId: '1111111111',
    sku: 'SKU-11',
    occurredAt: '2026-06-02T11:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  assert.equal(closeCalls.length, 1);
  assert.equal(closeCalls[0]?.recordId, 'rec-cross-channel');
  assert.equal(closeCalls[0]?.fields['eBay Last Webhook Event'], 'order.created');
});

test('does not trigger cross-channel Shopify close for cancel or refund order events', async () => {
  let closeCallCount = 0;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-no-cross-channel-refund',
        fields: {
          SKU: 'SKU-12',
          'eBay Listing ID': '1212121212',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, recordId, fields) => ({ id: recordId, createdTime: 'now', fields } as never),
    closeShopifyProductWhenSoldOnEbay: async () => {
      closeCallCount += 1;
      return { success: true, message: 'should not run' };
    },
  });

  const refundResponse = await handler(createEvent({
    eventType: 'order.refunded',
    listingId: '1212121212',
    sku: 'SKU-12',
    occurredAt: '2026-06-02T11:30:00.000Z',
  }));

  const cancelResponse = await handler(createEvent({
    eventType: 'order.cancelled',
    listingId: '1212121212',
    sku: 'SKU-12',
    occurredAt: '2026-06-02T11:31:00.000Z',
  }));

  assert.equal(refundResponse.statusCode, 200);
  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(closeCallCount, 0);
});

test('does not overwrite existing Post-Sale Outcome (precedence)', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-precedence',
        fields: {
          SKU: 'SKU-6',
          'eBay Listing ID': '6666666666',
          'Post-Sale Outcome': 'Cancelled',
          'Post-Sale Outcome At': '2026-06-02T09:00:00.000Z',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.refunded',
    listingId: '6666666666',
    sku: 'SKU-6',
    occurredAt: '2026-06-02T11:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  // Outcome should NOT be overwritten
  assert.equal(capturedFields?.['Post-Sale Outcome'], undefined);
  assert.equal(capturedFields?.['Post-Sale Outcome At'], undefined);
  // Audit fields should still be updated
  assert.equal(capturedFields?.['eBay Last Webhook Event'], 'order.refunded');
});

test('never writes Restock Disposition (relist block)', async () => {
  let capturedFields: Record<string, unknown> | null = null;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-relist-guard',
        fields: {
          SKU: 'SKU-7',
          'eBay Listing ID': '7777777777',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
  });

  const response = await handler(createEvent({
    eventType: 'order.cancelled',
    listingId: '7777777777',
    sku: 'SKU-7',
    occurredAt: '2026-06-02T10:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  // Assert that Restock Disposition is NOT in the update fields
  assert.equal(capturedFields?.['Restock Disposition'], undefined);
});

test('does not write post-sale outcome for non-order events', async () => {
  let capturedFields: Record<string, unknown> | null = null;
  let closeCallCount = 0;

  const handler = createHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: async () => ([
      {
        id: 'rec-listing-event',
        fields: {
          SKU: 'SKU-8',
          'eBay Listing ID': '8888888888',
          'Post-Sale Outcome': '',
        },
      },
    ] as never),
    updateConfiguredRecord: async (_source, _recordId, fields) => {
      capturedFields = fields;
      return { id: _recordId, createdTime: 'now', fields } as never;
    },
    closeShopifyProductWhenSoldOnEbay: async () => {
      closeCallCount += 1;
      return { success: true, message: 'should not run' };
    },
  });

  const response = await handler(createEvent({
    eventType: 'listing.updated',
    listingId: '8888888888',
    sku: 'SKU-8',
    status: 'published',
    occurredAt: '2026-06-02T12:00:00.000Z',
  }));

  assert.equal(response.statusCode, 200);
  // Non-order events should NOT write post-sale outcomes
  assert.equal(capturedFields?.['Post-Sale Outcome'], undefined);
  assert.equal(capturedFields?.['Post-Sale Outcome At'], undefined);
  // Audit fields should still be updated
  assert.equal(capturedFields?.['eBay Last Webhook Event'], 'listing.updated');
  assert.equal(closeCallCount, 0);
});