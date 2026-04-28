import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError } from './errors.js';
import {
  getOptionalQueryParam,
  jsonError,
  jsonOk,
  readIntegerQueryParam,
  requireJsonBody,
  requirePathParam,
  requireQueryParam,
} from './http.js';

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

test('jsonOk and jsonError return JSON responses with expected status codes', () => {
  const ok = jsonOk({ ok: true });
  const error = jsonError(422, { message: 'bad request' });

  assert.equal(typeof ok, 'object');
  assert.equal(typeof error, 'object');
  if (typeof ok === 'string' || typeof error === 'string') {
    throw new Error('Expected structured API Gateway responses');
  }

  assert.equal(ok.statusCode, 200);
  assert.equal(ok.headers?.['content-type'], 'application/json');
  assert.equal(ok.body, JSON.stringify({ ok: true }));

  assert.equal(error.statusCode, 422);
  assert.equal(error.headers?.['content-type'], 'application/json');
  assert.equal(error.body, JSON.stringify({ message: 'bad request' }));
});

test('query and path helpers trim values and throw HttpError for missing required params', () => {
  const event = createEvent({
    queryStringParameters: {
      limit: ' 25 ',
    },
    pathParameters: {
      slug: ' accuphase-e-530 ',
    },
  });

  assert.equal(getOptionalQueryParam(event, 'limit'), '25');
  assert.equal(requireQueryParam(event, 'limit', 'test', 'MISSING_LIMIT'), '25');
  assert.equal(requirePathParam(event, 'slug', 'test', 'MISSING_SLUG'), 'accuphase-e-530');

  assert.throws(
    () => requireQueryParam(createEvent(), 'limit', 'test', 'MISSING_LIMIT'),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'MISSING_LIMIT');
      return true;
    },
  );
});

test('requireJsonBody and readIntegerQueryParam handle valid, invalid, and clamped values', () => {
  const jsonEvent = createEvent({
    body: JSON.stringify({ slug: 'accuphase-e-530' }),
  });

  assert.deepEqual(requireJsonBody<{ slug: string }>(jsonEvent, 'test', 'INVALID_BODY'), {
    slug: 'accuphase-e-530',
  });

  const base64Event = createEvent({
    body: Buffer.from(JSON.stringify({ slug: 'base64-slug' }), 'utf8').toString('base64'),
    isBase64Encoded: true,
  });

  assert.deepEqual(requireJsonBody<{ slug: string }>(base64Event, 'test', 'INVALID_BODY'), {
    slug: 'base64-slug',
  });

  assert.equal(
    readIntegerQueryParam(
      createEvent({ queryStringParameters: { limit: '999' } }),
      'limit',
      { defaultValue: 10, min: 1, max: 100, service: 'test', code: 'INVALID_LIMIT' },
    ),
    100,
  );

  assert.throws(
    () => requireJsonBody(createEvent({ body: '{not-json' }), 'test', 'INVALID_BODY'),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, 'INVALID_BODY');
      return true;
    },
  );

  assert.throws(
    () => readIntegerQueryParam(createEvent({ queryStringParameters: { limit: '0' } }), 'limit', {
      defaultValue: 10,
      min: 1,
      max: 100,
      service: 'test',
      code: 'INVALID_LIMIT',
    }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, 'INVALID_LIMIT');
      return true;
    },
  );
});