import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './pushApprovalBundle.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/ebay/approval-listings/publish',
    rawPath: '/api/ebay/approval-listings/publish',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/ebay/approval-listings/publish',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/ebay/approval-listings/publish',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('ebay approval publish handler requires bundle or source plus recordId', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    pushApprovalBundleToEbay: async () => {
      throw new Error('should not be called');
    },
    buildEbayDraftPayloadBundleFromApprovalFields: () => {
      throw new Error('should not be called');
    },
    getConfiguredRecord: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ source: 'approval-ebay' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /Provide bundle\.inventoryItem and bundle\.offer or source and recordId/);
});

test('ebay approval publish handler builds bundle from source and recordId before publish', async () => {
  const calls: Array<{ source: string; recordId: string }> = [];
  const builtFromFields: Array<Record<string, unknown>> = [];
  const pushedBundles: Array<{ inventoryItem: { sku: string }; offer: { sku: string } }> = [];

  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    getConfiguredRecord: async (source, recordId) => {
      calls.push({ source, recordId });
      return {
        id: recordId,
        createdTime: 'now',
        fields: { SKU: 'ABC123', Title: 'Lambda Probe' },
      };
    },
    buildEbayDraftPayloadBundleFromApprovalFields: (fields) => {
      builtFromFields.push(fields);
      return {
        inventoryItem: { sku: 'ABC123' },
        offer: { sku: 'ABC123' },
      };
    },
    pushApprovalBundleToEbay: async (bundle) => {
      pushedBundles.push(bundle as unknown as { inventoryItem: { sku: string }; offer: { sku: string } });
      return {
        sku: 'ABC123',
        offerId: 'offer-1',
        listingId: 'listing-1',
        wasExistingOffer: false,
      };
    },
  });

  const response = await handler(createEvent({
    source: 'approval-ebay',
    recordId: 'rec123',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{ source: 'approval-ebay', recordId: 'rec123' }]);
  assert.deepEqual(builtFromFields, [{ SKU: 'ABC123', Title: 'Lambda Probe' }]);
  assert.deepEqual(pushedBundles, [{ inventoryItem: { sku: 'ABC123' }, offer: { sku: 'ABC123' } }]);
  assert.match(String(response.body), /"listingId":"listing-1"/);
});

test('ebay approval publish handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    pushApprovalBundleToEbay: async () => {
      throw new Error('should not be called');
    },
    buildEbayDraftPayloadBundleFromApprovalFields: () => {
      throw new Error('should not be called');
    },
    getConfiguredRecord: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ source: 'approval-ebay', recordId: 'rec123' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});