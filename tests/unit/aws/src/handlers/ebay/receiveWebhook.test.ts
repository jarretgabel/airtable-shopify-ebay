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