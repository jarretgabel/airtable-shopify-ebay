import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createUpdateHandler } from '../../../../../../aws/src/handlers/airtable/upsertConfiguredRecord.js';

function createEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/api/airtable/configured-records/users/rec-user-1',
    rawQueryString: '',
    headers: { origin: 'http://localhost:3000' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'PATCH',
        path: '/api/airtable/configured-records/users/rec-user-1',
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
    pathParameters: { source: 'users', recordId: 'rec-user-1' },
    body: JSON.stringify({
      fields: {
        'User Id': 'u-processor-sample',
        Name: 'Parker Processor',
        Email: 'processor@example.com',
        Role: 'processor',
        MustChangePassword: false,
        'Allowed Pages': 'dashboard,manual-intake,inventory,parking-lot-1,parking-lot-2,trash-review,testing-queue,photography-queue,testing,photos',
        Notifications: '{"workflowAssignedAlertsEnabled":true}',
        'Updated At': '2026-05-13',
      },
      typecast: true,
    }),
    ...overrides,
  } as APIGatewayProxyEventV2;
}

test('allows non-admin users to update their own Airtable user record when protected fields match the active session', async () => {
  let capturedOverride: object | undefined;
  let capturedUpdate: { source: string; recordId: string; fields: Record<string, unknown>; typecast?: boolean } | null = null;

  const handler = createUpdateHandler({
    requireRouteAccess: async (_event, override) => {
      capturedOverride = override;
      return {
        userId: 'u-processor-sample',
        airtableRecordId: 'rec-user-1',
        name: 'Parker Processor',
        email: 'processor@example.com',
        mustChangePassword: false,
        role: 'processor',
        allowedPages: ['dashboard', 'manual-intake', 'inventory', 'parking-lot-1', 'parking-lot-2', 'trash-review', 'testing-queue', 'photography-queue', 'testing', 'photos'],
      };
    },
    updateConfiguredRecord: async (source, recordId, fields, options) => {
      capturedUpdate = { source, recordId, fields, typecast: options.typecast };
      return {
        id: recordId,
        createdTime: '2026-05-13T00:00:00.000Z',
        fields,
      };
    },
  });

  const response = await handler(createEvent());

  assert.deepEqual(capturedOverride, {});
  assert.equal(response.statusCode, 200);
  assert.ok(capturedUpdate);
  assert.equal(capturedUpdate?.source, 'users');
  assert.equal(capturedUpdate?.recordId, 'rec-user-1');
  assert.equal(capturedUpdate?.typecast, true);
});

test('rejects non-admin users who try to patch another user record', async () => {
  const handler = createUpdateHandler({
    requireRouteAccess: async () => ({
      userId: 'u-processor-sample',
      airtableRecordId: 'rec-user-1',
      name: 'Parker Processor',
      email: 'processor@example.com',
      mustChangePassword: false,
      role: 'processor',
      allowedPages: ['dashboard', 'inventory'],
    }),
    updateConfiguredRecord: async () => {
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent({
    pathParameters: { source: 'users', recordId: 'rec-other-user' },
    rawPath: '/api/airtable/configured-records/users/rec-other-user',
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'PATCH',
        path: '/api/airtable/configured-records/users/rec-other-user',
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
  }));

  assert.equal(response.statusCode, 403);
  assert.match(response.body || '', /own account settings/i);
});

test('rejects non-admin users who try to change protected fields on their own record', async () => {
  const handler = createUpdateHandler({
    requireRouteAccess: async () => ({
      userId: 'u-processor-sample',
      airtableRecordId: 'rec-user-1',
      name: 'Parker Processor',
      email: 'processor@example.com',
      mustChangePassword: false,
      role: 'processor',
      allowedPages: ['dashboard', 'inventory'],
    }),
    updateConfiguredRecord: async () => {
      throw new Error('Should not be called');
    },
  });

  const response = await handler(createEvent({
    body: JSON.stringify({
      fields: {
        'User Id': 'u-processor-sample',
        Name: 'Parker Processor',
        Email: 'processor@example.com',
        Role: 'admin',
        MustChangePassword: false,
        'Allowed Pages': 'dashboard,inventory',
        Notifications: '{"workflowAssignedAlertsEnabled":true}',
        'Updated At': '2026-05-13',
      },
    }),
  }));

  assert.equal(response.statusCode, 403);
  assert.match(response.body || '', /role changes require admin or owner access/i);
});