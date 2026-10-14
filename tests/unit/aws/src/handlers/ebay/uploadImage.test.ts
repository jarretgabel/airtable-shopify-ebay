import test from 'node:test';
import assert from 'node:assert/strict';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler } from '../../../../../../aws/src/handlers/ebay/uploadImage.js';
import { HttpError } from '../../../../../../aws/src/shared/errors.js';

function createEvent(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /api/ebay/images',
    rawPath: '/api/ebay/images',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: 'test',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: 'localhost',
      http: {
        method: 'POST',
        path: '/api/ebay/images',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'request',
      routeKey: 'POST /api/ebay/images',
      stage: '$default',
      time: 'now',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

test('eBay image handler uploads an external source URL', async () => {
  let receivedUrl = '';
  let receivedIndex: number | undefined;
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    uploadExternalImageUrlToEbayHostedPictures: async (sourceUrl, index) => {
      receivedUrl = sourceUrl;
      receivedIndex = index;
      return { url: 'https://i.ebayimg.com/example.jpg' };
    },
    uploadImageToEbayHostedPictures: async () => {
      throw new Error('file upload should not be called');
    },
  });

  const response = await handler(createEvent({ sourceUrl: 'https://drive.google.com/example', index: 3 }));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 200);
  assert.equal(receivedUrl, 'https://drive.google.com/example');
  assert.equal(receivedIndex, 3);
  assert.deepEqual(JSON.parse(String(response.body)), { url: 'https://i.ebayimg.com/example.jpg' });
});

test('eBay image handler still requires sourceUrl or file data', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    uploadExternalImageUrlToEbayHostedPictures: async () => ({ url: '' }),
    uploadImageToEbayHostedPictures: async () => ({ url: '' }),
  });

  const response = await handler(createEvent({}));
  if (typeof response === 'string') throw new Error('Expected structured response');

  assert.equal(response.statusCode, 400);
  assert.match(String(response.body), /sourceUrl or filename and file are required/);
});

test('eBay image handler forwards cached fingerprints and reports reuse', async () => {
  const cache = { url: 'https://i.ebayimg.com/cached.jpg', sha256: 'a'.repeat(64) };
  const handler = createHandler({
    requireRouteAccess: async () => ({ userId: 'u-admin', mustChangePassword: false, role: 'admin', allowedPages: [] }),
    uploadExternalImageUrlToEbayHostedPictures: async (_url, index, cachedImage) => {
      assert.equal(index, 2);
      assert.deepEqual(cachedImage, cache);
      return { ...cache, reused: true };
    },
    uploadImageToEbayHostedPictures: async () => { throw new Error('File upload should not run'); },
  });
  const response = await handler(createEvent({ sourceUrl: 'https://drive.google.com/uc?id=image', index: 2, cachedImage: cache }));
  if (typeof response === 'string') throw new Error('Expected structured response');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(String(response.body)), { ...cache, reused: true });
});

test('eBay image preparation remains blocked when route access is denied', async () => {
  const handler = createHandler({
    requireRouteAccess: async () => { throw new HttpError(403, 'Access denied', { service: 'auth', code: 'ACCESS_DENIED' }); },
    uploadExternalImageUrlToEbayHostedPictures: async () => { throw new Error('Image preparation must not run'); },
    uploadImageToEbayHostedPictures: async () => { throw new Error('File upload must not run'); },
  });
  const response = await handler(createEvent({ sourceUrl: 'https://drive.google.com/uc?id=image' }));
  if (typeof response === 'string') throw new Error('Expected structured response');
  assert.equal(response.statusCode, 403);
});