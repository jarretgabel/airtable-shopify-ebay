import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './publish.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/approval/publish',
    rawPath: '/api/approval/publish',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/approval/publish',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/approval/publish',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('approval publish handler requires target, source, and recordId', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    executeApprovalPublish: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ target: 'shopify', source: 'approval-shopify' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /target, source, and recordId are required/);
});

test('approval publish handler executes orchestration after target-specific access checks', async () => {
  const accessCalls: Array<Record<string, unknown>> = [];
  const executionCalls: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    requireRouteAccess: async (_event, override) => {
      accessCalls.push(override as Record<string, unknown>);
      return { userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] };
    },
    executeApprovalPublish: async (input) => {
      executionCalls.push(input as unknown as Record<string, unknown>);
      return {
        target: 'both',
        shopify: {
          productId: '99',
          mode: 'updated',
          warnings: [],
          wroteProductId: false,
          staleProductIdCleared: false,
        },
        ebay: {
          sku: 'ABC123',
          offerId: 'offer-1',
          listingId: 'listing-1',
          wasExistingOffer: false,
          mode: 'created',
        },
        failures: [],
      };
    },
  });

  const response = await handler(createEvent({
    target: 'both',
    source: 'approval-combined',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
    fields: { Title: 'Edited title' },
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(accessCalls, [
    { anyPage: ['shopify-approval'] },
    { anyPage: ['approval'] },
  ]);
  assert.deepEqual(executionCalls, [{
    target: 'both',
    source: 'approval-combined',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
    publishSetup: undefined,
    fields: { Title: 'Edited title' },
  }]);
  assert.match(String(response.body), /"productId":"99"/);
  assert.match(String(response.body), /"listingId":"listing-1"/);
});

test('approval publish handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    executeApprovalPublish: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ target: 'shopify', source: 'approval-shopify', recordId: 'rec123' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});

test('approval publish handler rejects invalid publishSetup contract shapes', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    executeApprovalPublish: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({
    target: 'ebay',
    source: 'approval-ebay',
    recordId: 'rec123',
    publishSetup: {
      locationConfig: {
        key: 'resolution-av-warehouse',
        name: 'Resolution AV Warehouse',
        country: 'US',
        postalCode: '10001',
        city: 'New York',
      },
      policyConfig: {
        fulfillmentPolicyId: '123',
        paymentPolicyId: '456',
      },
    },
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /publishSetup is invalid/);
});

test('approval publish handler rejects empty productIdFieldName values', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    executeApprovalPublish: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({
    target: 'shopify',
    source: 'approval-shopify',
    recordId: 'rec123',
    productIdFieldName: '',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /productIdFieldName must be a non-empty string when provided/);
});