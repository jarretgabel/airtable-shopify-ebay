import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/shopify/getProduct.js';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';
import type { ShopifyShippingInspection } from '../../../../../../aws/src/shared/contracts/shopifyShipping.js';

const allowAccess = async () => ({
  userId: 'u-admin', mustChangePassword: false, role: 'admin' as const, allowedPages: [],
});
function event(productId = '123', view?: string): APIGatewayProxyEventV2 {
  return {
    headers: {}, pathParameters: { productId }, queryStringParameters: view ? { view } : {},
    requestContext: { http: { method: 'GET' } },
  } as APIGatewayProxyEventV2;
}

test('product read preserves its default response without invoking shipping inspection', async () => {
  const product = { id: 123, adminGraphqlApiId: 'gid://shopify/Product/123', title: 'Amp', handle: 'amp', status: 'ACTIVE' };
  const handler = createHandler({
    requireRouteAccess: allowAccess,
    getProduct: async (id) => { assert.equal(id, 123); return product; },
    getProductShippingInspection: async () => { throw new Error('Unexpected inspection'); },
  });
  const result = await handler(event());
  if (typeof result === 'string') throw new Error('Expected structured response');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(String(result.body)), product);
});

test('shipping view forwards inspection without invoking the default product reader', async () => {
  const inspection: ShopifyShippingInspection = {
    productId: 'gid://shopify/Product/123', servedApiVersion: '2025-10',
    accessScopes: ['read_products'], packageAssignmentSupported: true, inventoryPackageFields: [],
    packageQueries: [], packageMutations: [],
    shopPackageFields: [], measurementPackageFields: [],
    packedSizeSchema: {
      measurementInputFields: ['weight', 'shippingPackageId'], inventoryItemInputFields: ['measurement'],
      variantInputFields: ['inventoryItem'], measurementOutputFields: ['weight'], inventoryItemOutputFields: ['measurement'],
    },
    variants: [], variantsTruncated: false, dimensionMetafields: { width: null, depth: null, height: null },
  };
  const handler = createHandler({
    requireRouteAccess: allowAccess,
    getProduct: async () => { throw new Error('Unexpected default read'); },
    getProductShippingInspection: async (id) => { assert.equal(id, 123); return inspection; },
  });
  const result = await handler(event('123', 'shipping'));
  if (typeof result === 'string') throw new Error('Expected structured response');
  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(String(result.body)), inspection);
});

test('shipping view rejects unauthorized access before reading Shopify', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => { throw new HttpError(401, 'Unauthorized', { service: 'auth', code: 'UNAUTHORIZED' }); },
    getProductShippingInspection: async () => { throw new Error('Unexpected inspection'); },
  });
  const result = await handler(event('123', 'shipping'));
  if (typeof result === 'string') throw new Error('Expected structured response');
  assert.equal(result.statusCode, 401);
});

test('product view rejects invalid IDs and unsupported views before reading Shopify', async () => {
  const handler = createHandler({
    requireRouteAccess: allowAccess,
    getProductShippingInspection: async () => { throw new Error('Unexpected inspection'); },
  });
  for (const input of [event('abc', 'shipping'), event('-1', 'shipping'), event('0', 'shipping'), event('123', 'unknown')]) {
    const result = await handler(input);
    if (typeof result === 'string') throw new Error('Expected structured response');
    assert.equal(result.statusCode, 400);
  }
});

test('shipping view preserves null for missing products and surfaces upstream failures', async () => {
  const handler = createHandler({
    requireRouteAccess: allowAccess,
    getProductShippingInspection: async (id) => {
      if (id === 123) return null;
      throw new HttpError(502, 'Shopify unavailable', { service: 'shopify', code: 'SHOPIFY_HTTP_ERROR' });
    },
  });
  const missing = await handler(event('123', 'shipping'));
  if (typeof missing === 'string') throw new Error('Expected structured response');
  assert.equal(missing.statusCode, 200);
  assert.equal(JSON.parse(String(missing.body)), null);
  const failed = await handler(event('456', 'shipping'));
  if (typeof failed === 'string') throw new Error('Expected structured response');
  assert.equal(failed.statusCode, 502);
  assert.match(String(failed.body), /Shopify unavailable/);
});
