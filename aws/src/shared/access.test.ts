import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { resolveRouteAccessRequirement } from './access.js';

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

  assert.equal(inventoryRequirement.adminOnly, undefined);
  assert.deepEqual(inventoryRequirement.anyPage, ['inventory']);
});