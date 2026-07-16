import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/approval/takeDown.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/approval/takedown',
    rawPath: '/api/approval/takedown',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/approval/takedown',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/approval/takedown',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('approval takedown handler requires target and recordId', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    getConfiguredRecord: async () => {
      throw new Error('should not be called');
    },
    closeShopifyProductWhenSoldOnEbay: async () => ({ success: true, message: 'ok', closedAt: '2026-01-01T00:00:00.000Z' }),
    closeEbayListingWhenSoldOnShopify: async () => ({ success: true, message: 'ok', closedAt: '2026-01-01T00:00:00.000Z' }),
  });

  const response = await handler(createEvent({ recordId: 'rec123' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /target and recordId are required/);
});

test('approval takedown handler runs selected channel closures', async () => {
  const closeShopifyCalls: string[] = [];
  const closeShopifyOptions: Array<Record<string, unknown> | undefined> = [];
  const closeEbayCalls: string[] = [];

  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    getConfiguredRecord: async () => ({
      id: 'rec123',
      createdTime: '2026-01-01T00:00:00.000Z',
      fields: {
        'Shopify REST Product ID': '101',
        'eBay Offer ID': 'offer-1',
      },
    }),
    closeShopifyProductWhenSoldOnEbay: async (recordId, _fields, options) => {
      closeShopifyCalls.push(recordId);
      closeShopifyOptions.push(options as Record<string, unknown> | undefined);
      return { success: true, message: 'shopify closed', closedAt: '2026-01-01T00:00:00.000Z' };
    },
    closeEbayListingWhenSoldOnShopify: async (recordId) => {
      closeEbayCalls.push(recordId);
      return { success: true, message: 'ebay closed', closedAt: '2026-01-01T00:00:00.000Z' };
    },
  });

  const response = await handler(createEvent({ target: 'both', recordId: 'rec123' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(closeShopifyCalls, ['rec123']);
  assert.deepEqual(closeShopifyOptions, [{ forceShopifyDelete: true }]);
  assert.deepEqual(closeEbayCalls, ['rec123']);
  assert.match(String(response.body), /"success":true/);
  assert.match(String(response.body), /shopify/);
  assert.match(String(response.body), /ebay/);
});
