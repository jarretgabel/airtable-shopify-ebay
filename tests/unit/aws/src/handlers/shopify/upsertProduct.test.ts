import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/shopify/upsertProduct.js';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0', routeKey: 'POST /api/shopify/product-set', rawPath: '/api/shopify/product-set',
    rawQueryString: '', headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test', apiId: 'test', domainName: 'localhost', domainPrefix: 'localhost',
      http: { method: 'POST', path: '/api/shopify/product-set', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'request', routeKey: 'POST /api/shopify/product-set', stage: '$default', time: 'now', timeEpoch: 0,
    },
    body: JSON.stringify(body), isBase64Encoded: false,
  };
}

const product = { id: 123, adminGraphqlApiId: 'gid://shopify/Product/123', title: 'Test product', status: 'ACTIVE', onlineStoreUrl: 'https://test-shop.myshopify.com/products/test' };
const requireAccess = async () => ({ userId: 'admin', mustChangePassword: false, role: 'admin', allowedPages: [] });

test('publication-only action never creates or rewrites a product', async () => {
  const handler = createHandler({
    requireRouteAccess: requireAccess,
    upsertProductWithUnifiedRequest: async () => { throw new Error('Must not upsert'); },
    publishProductToOnlineStore: async (id) => { assert.equal(id, 123); return product; },
  });
  const response = await handler(createEvent({ action: 'publish-online-store', productId: 123 }));
  if (typeof response === 'string') throw new Error('Expected structured response');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(String(response.body)), product);
});

test('existing product-set request contract remains unchanged', async () => {
  const request = { input: { title: 'Test product' }, synchronous: true };
  const handler = createHandler({
    requireRouteAccess: requireAccess,
    upsertProductWithUnifiedRequest: async (value) => { assert.deepEqual(value, request); return product; },
    publishProductToOnlineStore: async () => { throw new Error('Must not publish a generic upsert'); },
  });
  const response = await handler(createEvent({ request }));
  if (typeof response === 'string') throw new Error('Expected structured response');
  assert.equal(response.statusCode, 200);
});

test('publication action is blocked before any provider call when access is denied', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => { throw new HttpError(403, 'Access denied', { service: 'auth', code: 'ACCESS_DENIED' }); },
    upsertProductWithUnifiedRequest: async () => { throw new Error('Must not upsert'); },
    publishProductToOnlineStore: async () => { throw new Error('Must not publish'); },
  });
  const response = await handler(createEvent({ action: 'publish-online-store', productId: 123 }));
  if (typeof response === 'string') throw new Error('Expected structured response');
  assert.equal(response.statusCode, 403);
});

test('invalid and ambiguous publication requests fail explicitly', async () => {
  const handler = createHandler({
    requireRouteAccess: requireAccess,
    upsertProductWithUnifiedRequest: async () => { throw new Error('Must not upsert'); },
    publishProductToOnlineStore: async () => { throw new Error('Must not publish'); },
  });
  for (const body of [
    { action: 'publish-online-store', productId: 0 },
    { action: 'publish-online-store', productId: '123' },
    { action: 'publish-online-store', productId: 123, request: { input: { title: 'Test' } } },
    { action: 'unknown', productId: 123 },
  ]) {
    const response = await handler(createEvent(body));
    if (typeof response === 'string') throw new Error('Expected structured response');
    assert.equal(response.statusCode, 400);
  }
});
