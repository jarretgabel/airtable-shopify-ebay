import assert from 'node:assert/strict';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { jsonOk } from './http.js';

const big = Array.from({ length: 20000 }, (_, i) => ({ id: `rec${i}`, fields: { Name: 'x'.repeat(40) } }));

test('jsonOk leaves responses untouched unless compression is requested', () => {
  const result = jsonOk(big, { origin: 'http://localhost:3000' }) as { body: string; isBase64Encoded?: boolean };
  assert.equal(result.isBase64Encoded, undefined);
  assert.deepEqual(JSON.parse(result.body), big);
});

test('jsonOk gzips large bodies for clients that accept gzip', () => {
  const result = jsonOk(big, { origin: 'http://localhost:3000', acceptEncoding: 'gzip, deflate, br' }) as {
    body: string; isBase64Encoded?: boolean; headers: Record<string, string>;
  };
  assert.equal(result.isBase64Encoded, true);
  assert.equal(result.headers['content-encoding'], 'gzip');
  assert.equal(result.headers.vary, 'origin, accept-encoding');
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(result.body, 'base64')).toString()), big);
  assert.ok(result.body.length < JSON.stringify(big).length / 4);
});

test('jsonOk does not compress small bodies or clients without gzip', () => {
  const small = jsonOk([{ id: 'a' }], { acceptEncoding: 'gzip' }) as { isBase64Encoded?: boolean };
  assert.equal(small.isBase64Encoded, undefined);
  const noGzip = jsonOk(big, { acceptEncoding: 'identity' }) as { isBase64Encoded?: boolean };
  assert.equal(noGzip.isBase64Encoded, undefined);
});

test('jsonOk with etag adds a stable validator and answers 304 on a match', () => {
  const first = jsonOk([{ id: 'a' }], { origin: 'http://localhost:3000', etag: {} }) as { headers: Record<string, string>; statusCode: number };
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['cache-control'], 'private, no-cache');
  const tag = first.headers.etag;
  assert.match(tag, /^".+"$/);
  const again = jsonOk([{ id: 'a' }], { etag: { ifNoneMatch: tag } }) as { statusCode: number; body: string };
  assert.equal(again.statusCode, 304);
  assert.equal(again.body, '');
  const changed = jsonOk([{ id: 'b' }], { etag: { ifNoneMatch: tag } }) as { statusCode: number };
  assert.equal(changed.statusCode, 200);
});
