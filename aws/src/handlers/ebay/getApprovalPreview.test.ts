import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from './getApprovalPreview.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/ebay/approval-listings/preview',
    rawPath: '/api/ebay/approval-listings/preview',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/ebay/approval-listings/preview',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/ebay/approval-listings/preview',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('ebay approval preview handler requires fields', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    buildEbayApprovalPreviewFromFields: () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ bodyPreview: { templateHtml: '<div></div>', title: 'Amp', description: 'Desc', keyFeatures: '' } }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /fields are required/);
});

test('ebay approval preview handler forwards fields and bodyPreview contract', async () => {
  const calls: Array<{ fields: Record<string, unknown>; bodyPreview?: Record<string, unknown> }> = [];
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    buildEbayApprovalPreviewFromFields: (fields, bodyPreview) => {
      calls.push({ fields, bodyPreview: bodyPreview as Record<string, unknown> | undefined });
      return {
        generatedBodyHtml: '<p>Preview</p>',
        draftPayloadBundle: {
          inventoryItem: { sku: 'ABC123' },
          offer: { sku: 'ABC123' },
        },
      };
    },
  });

  const bodyPreview = {
    templateHtml: '<html>{{title}}</html>',
    title: 'Amp',
    description: 'Great amp',
    keyFeatures: 'Power:100W',
    testingNotes: 'Tested',
    fieldName: 'eBay Body HTML',
  };

  const response = await handler(createEvent({ fields: { Title: 'Amp' }, bodyPreview }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{ fields: { Title: 'Amp' }, bodyPreview }]);
  assert.match(String(response.body), /"generatedBodyHtml":"<p>Preview<\/p>"/);
});

test('ebay approval preview handler rejects unauthenticated requests', async () => {
  const handler = createHandler({
    buildEbayApprovalPreviewFromFields: () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent({ fields: { Title: 'Amp' } }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 401);
  assert.match(String(response.body), /Session is invalid/);
});