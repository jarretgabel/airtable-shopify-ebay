import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { uploadExternalImageUrlToEbayHostedPictures } from '../../../../../../aws/src/providers/ebay/client.js';

const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const cache = { url: 'https://i.ebayimg.com/existing.jpg', sha256: createHash('sha256').update(bytes).digest('hex') };
const sourceUrl = 'https://drive.google.com/uc?id=image-reuse-test';

test('unchanged image content reuses an accessible eBay URL without an upload or OAuth request', async () => {
  const originalFetch = global.fetch;
  const calls: Array<{ url: string; method?: string }> = [];
  global.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method });
    if (url.includes('drive.google.com')) return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
    assert.equal(url, cache.url);
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  };
  try {
    assert.deepEqual(await uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, cache), { ...cache, reused: true });
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

for (const scenario of ['changed', 'new', 'missing', 'gone'] as const) {
  test(`${scenario} image uploads instead of reusing stale or absent data`, async () => {
    const originalFetch = global.fetch;
    const keys = ['EBAY_ENV', 'EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_REFRESH_TOKEN'] as const;
    const previous = keys.map((key) => process.env[key]);
    Object.assign(process.env, { EBAY_ENV: 'production', EBAY_CLIENT_ID: 'test-client', EBAY_CLIENT_SECRET: 'test-secret', EBAY_REFRESH_TOKEN: 'test-refresh' });
    let uploads = 0;
    let headCalls = 0;
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('drive.google.com')) return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
      if (url === cache.url) {
        headCalls += 1;
        assert.equal(init?.method, 'HEAD');
        return new Response(null, { status: scenario === 'gone' ? 410 : 404 });
      }
      if (url.includes('/identity/v1/oauth2/token')) {
        return Response.json({ access_token: 'test-token', expires_in: 7200 });
      }
      assert.ok(url.endsWith('/ws/api.dll'), `Unexpected URL: ${url}`);
      assert.ok(init?.body instanceof FormData);
      uploads += 1;
      return new Response('<UploadSiteHostedPicturesResponse><Ack>Success</Ack><FullURL>https://i.ebayimg.com/new.jpg</FullURL></UploadSiteHostedPicturesResponse>');
    };
    try {
      const prior = scenario === 'new' ? undefined : scenario === 'changed' ? { ...cache, sha256: 'a'.repeat(64) } : cache;
      const result = await uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, prior);
      assert.deepEqual(result, { url: 'https://i.ebayimg.com/new.jpg', sha256: cache.sha256, reused: false });
      assert.equal(uploads, 1);
      assert.equal(headCalls, scenario === 'missing' || scenario === 'gone' ? 1 : 0);
    } finally {
      global.fetch = originalFetch;
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key];
        else process.env[key] = previous[index];
      });
    }
  });
}

test('temporary eBay image verification errors are explicit and do not trigger duplicate uploads', async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (input) => {
    calls += 1;
    if (String(input).includes('drive.google.com')) return new Response(bytes, { headers: { 'content-type': 'image/jpeg' } });
    assert.equal(String(input), cache.url);
    return new Response(null, { status: 503 });
  };
  try {
    await assert.rejects(uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, cache), /Could not verify existing eBay image 1/);
    assert.equal(calls, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('invalid fingerprints and non-eBay cache URLs are rejected before downloading', async () => {
  await assert.rejects(uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, { ...cache, sha256: 'invalid' }), /Invalid saved eBay image/);
  await assert.rejects(uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, { ...cache, url: 'https://example.com/image.jpg' }), /Invalid saved eBay image/);
});

test('an HTTP 200 error page is not treated as an existing eBay image', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (input) => String(input).includes('drive.google.com')
    ? new Response(bytes, { headers: { 'content-type': 'image/jpeg' } })
    : new Response(null, { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    await assert.rejects(uploadExternalImageUrlToEbayHostedPictures(sourceUrl, 0, cache), /did not return an image file/);
  } finally {
    global.fetch = originalFetch;
  }
});
