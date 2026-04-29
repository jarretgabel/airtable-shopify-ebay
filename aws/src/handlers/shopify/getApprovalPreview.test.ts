import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './getApprovalPreview.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/shopify/approval-listings/preview',
    rawPath: '/api/shopify/approval-listings/preview',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/shopify/approval-listings/preview',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/shopify/approval-listings/preview',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('shopify approval preview handler requires fields', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    buildShopifyApprovalPreviewFromFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({}));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /fields are required/);
});

test('shopify approval preview handler forwards fields contract', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    buildShopifyApprovalPreviewFromFields: async (fields) => {
      calls.push(fields);
      return {
        draftProduct: { title: 'Amp' },
        effectiveProduct: { title: 'Amp' },
        tagValues: ['vintage', 'amp'],
        collectionIds: [],
        bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Amp</p>' },
        productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Amp' },
        productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
        categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
        categoryLookupValue: 'Amplifiers',
        categoryResolution: { status: 'resolved', match: null, error: '' },
        productSetRequest: { input: { title: 'Amp' }, synchronous: true },
      };
    },
  });

  const response = await handler(createEvent({ fields: { Title: 'Amp' } }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{ Title: 'Amp' }]);
  assert.match(String(response.body), /"categoryLookupValue":"Amplifiers"/);
});

test('shopify approval preview handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    buildShopifyApprovalPreviewFromFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ fields: { Title: 'Amp' } }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});