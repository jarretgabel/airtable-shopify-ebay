import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './publishApprovalListing.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/shopify/approval-listings/publish',
    rawPath: '/api/shopify/approval-listings/publish',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/shopify/approval-listings/publish',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/shopify/approval-listings/publish',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('shopify approval publish handler requires source and recordId', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    publishApprovalListingToShopify: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ source: 'approval-shopify' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /source and recordId are required/);
});

test('shopify approval publish handler forwards source and recordId contract', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    publishApprovalListingToShopify: async (input) => {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        productId: '99',
        mode: 'updated',
        warnings: [],
        wroteProductId: false,
        staleProductIdCleared: false,
      };
    },
  });

  const response = await handler(createEvent({
    source: 'approval-shopify',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{
    source: 'approval-shopify',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
  }]);
  assert.match(String(response.body), /"productId":"99"/);
});

test('shopify approval publish handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    publishApprovalListingToShopify: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ source: 'approval-shopify', recordId: 'rec123' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});