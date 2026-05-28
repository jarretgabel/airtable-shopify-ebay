import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';
import { createHandler } from '../../../../../../aws/src/handlers/jotform/ingestSubmissionWebhook.js';

function createEvent(body: string, options: {
  contentType?: string;
  queryToken?: string;
  pathFormId?: string;
} = {}): APIGatewayProxyEventV2 {
  const formId = options.pathFormId ?? 'form-abc';
  const tokenQuery = options.queryToken ? `token=${encodeURIComponent(options.queryToken)}` : '';

  return {
    version: '2.0',
    routeKey: 'POST /api/hooks/jotform/submissions/{formId}',
    rawPath: `/api/hooks/jotform/submissions/${formId}`,
    rawQueryString: tokenQuery,
    headers: { 'content-type': options.contentType ?? 'application/json' },
    queryStringParameters: options.queryToken ? { token: options.queryToken } : undefined,
    pathParameters: { formId },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: `/api/hooks/jotform/submissions/${formId}`,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/hooks/jotform/submissions/{formId}',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('jotform ingest webhook handler forwards form and submission ids to the ingest provider', async () => {
  const ingestCalls: Array<{ formId: string; submissionId: string }> = [];
  const handler = createHandler({
    requireWebhookSecret: () => undefined,
    ingestJotFormSubmissionWorkflow: async (formId, submissionId) => {
      ingestCalls.push({ formId, submissionId });
      return {
        formId,
        submissionId,
        items: [{ recordId: 'rec-1', submissionId, action: 'created', imageCount: 2 }],
      };
    },
  });

  const response = await handler(createEvent(JSON.stringify({ submissionId: 'sub-123' })));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(ingestCalls, [{ formId: 'form-abc', submissionId: 'sub-123' }]);
  assert.match(String(response.body), /"recordId":"rec-1"/);
});

test('jotform ingest webhook handler accepts form-encoded payloads with query-token auth', async () => {
  const ingestCalls: Array<{ formId: string; submissionId: string }> = [];
  const handler = createHandler({
    requireWebhookSecret: () => undefined,
    ingestJotFormSubmissionWorkflow: async (formId, submissionId) => {
      ingestCalls.push({ formId, submissionId });
      return {
        formId,
        submissionId,
        items: [],
      };
    },
  });

  const response = await handler(createEvent('submission_id=sub-456', {
    contentType: 'application/x-www-form-urlencoded',
    queryToken: 'webhook-secret',
  }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(ingestCalls, [{ formId: 'form-abc', submissionId: 'sub-456' }]);
});

test('jotform ingest webhook handler rejects payloads without a submission id', async () => {
  const handler = createHandler({
    requireWebhookSecret: () => undefined,
    ingestJotFormSubmissionWorkflow: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent(JSON.stringify({}))); 
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /submissionId is required/);
});

test('jotform ingest webhook handler rejects invalid webhook secrets', async () => {
  const handler = createHandler({
    requireWebhookSecret: () => {
      throw new HttpError(403, 'Invalid webhook secret.', {
        service: 'jotform',
        code: 'JOTFORM_WEBHOOK_FORBIDDEN',
        retryable: false,
      });
    },
    ingestJotFormSubmissionWorkflow: async () => {
      throw new Error('should not be called');
    },
  });

  const response = await handler(createEvent(JSON.stringify({ submissionId: 'sub-123' })));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 403);
  assert.match(String(response.body), /Invalid webhook secret/);
});