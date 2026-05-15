import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { resolveRouteAccessRequirement } from '../../../../../aws/src/shared/access.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'GET',
        path: '/',
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
    ...overrides,
  } as APIGatewayProxyEventV2;
}

test('Airtable users source routes are marked admin-only', () => {
  const readRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/airtable/configured-records',
    queryStringParameters: { source: 'users' },
  }));
  const writeRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/airtable/configured-records/users',
    pathParameters: { source: 'users' },
  }));

  assert.equal(readRequirement.adminOnly, true);
  assert.deepEqual(readRequirement.anyPage, ['users']);
  assert.equal(writeRequirement.adminOnly, true);
  assert.deepEqual(writeRequirement.anyPage, ['users']);
});

test('non-user Airtable configured routes keep page-based access rules', () => {
  const inventoryRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/airtable/configured-records/inventory-directory',
    pathParameters: { source: 'inventory-directory' },
  }));
  const usedGearRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/airtable/configured-records/used-gear-workflow',
    pathParameters: { source: 'used-gear-workflow' },
  }));

  assert.equal(inventoryRequirement.adminOnly, undefined);
  assert.deepEqual(inventoryRequirement.anyPage, ['inventory', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'testing-queue', 'photography-queue', 'pre-listing-queue', 'incoming-gear', 'testing', 'photos']);
  assert.equal(usedGearRequirement.adminOnly, undefined);
  assert.deepEqual(usedGearRequirement.anyPage, ['inventory', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'testing-queue', 'photography-queue', 'pre-listing-queue', 'incoming-gear', 'testing', 'photos']);
});

test('airtable listings route uses inventory access', () => {
  const listingsRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/airtable/listings',
  }));

  assert.equal(listingsRequirement.adminOnly, undefined);
  assert.deepEqual(listingsRequirement.anyPage, ['inventory']);
});

test('utility routes keep their specific page requirements', () => {
  const imageLabRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/ai/generate-image',
  }));
  const hiFiSharkRequirement = resolveRouteAccessRequirement(createEvent({
    rawPath: '/api/hifishark/search',
  }));

  assert.equal(imageLabRequirement.adminOnly, undefined);
  assert.deepEqual(imageLabRequirement.anyPage, ['imagelab']);
  assert.equal(hiFiSharkRequirement.adminOnly, undefined);
  assert.deepEqual(hiFiSharkRequirement.anyPage, ['market']);
});
