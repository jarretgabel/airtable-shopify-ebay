import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './normalize.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/approval/normalize',
    rawPath: '/api/approval/normalize',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/approval/normalize',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/approval/normalize',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('approval normalize handler requires target and fields', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    normalizeApprovalFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ target: 'both' }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /target and fields are required/);
});

test('approval normalize handler forwards fields, bodyPreview, and categoryPreview with target-specific access checks', async () => {
  const accessCalls: Array<Record<string, unknown>> = [];
  const normalizeCalls: Array<Record<string, unknown>> = [];
  const handler = createHandler({
    requireRouteAccess: async (_event, override) => {
      accessCalls.push(override as Record<string, unknown>);
      return { userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] };
    },
    normalizeApprovalFields: async (input) => {
      normalizeCalls.push(input as unknown as Record<string, unknown>);
      return {
        target: 'both',
        shopify: {
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
        },
        ebay: {
          generatedBodyHtml: '<p>Preview</p>',
          draftPayloadBundle: { inventoryItem: { sku: 'ABC123' }, offer: { sku: 'ABC123' } },
        },
      };
    },
  });

  const bodyPreview = {
    templateHtml: '<html>{{title}}</html>',
    title: 'Amp',
    description: 'Great amp',
    keyFeatures: 'Power:100W',
  };
  const categoryPreview = {
    labelsById: {
      '3276': 'Amplifiers & Preamps',
    },
  };
  const response = await handler(createEvent({ target: 'both', fields: { Title: 'Amp' }, bodyPreview, categoryPreview }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(accessCalls, [
    { anyPage: ['shopify-approval'] },
    { anyPage: ['approval'] },
  ]);
  assert.deepEqual(normalizeCalls, [{ target: 'both', fields: { Title: 'Amp' }, bodyPreview, categoryPreview }]);
  assert.match(String(response.body), /"generatedBodyHtml":"<p>Preview<\/p>"/);
});

test('approval normalize handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    normalizeApprovalFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ target: 'shopify', fields: { Title: 'Amp' } }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});

test('approval normalize handler rejects invalid bodyPreview contract shapes', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    normalizeApprovalFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({
    target: 'ebay',
    fields: { Title: 'Amp' },
    bodyPreview: {
      templateHtml: 123,
      title: 'Amp',
      description: 'Great amp',
      keyFeatures: 'Power:100W',
    },
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /bodyPreview is invalid/);
});

test('approval normalize handler rejects invalid categoryPreview label maps', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    normalizeApprovalFields: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({
    target: 'ebay',
    fields: { Title: 'Amp' },
    categoryPreview: {
      labelsById: {
        '3276': 123,
      },
    },
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /categoryPreview\.labelsById must be a string map/);
});