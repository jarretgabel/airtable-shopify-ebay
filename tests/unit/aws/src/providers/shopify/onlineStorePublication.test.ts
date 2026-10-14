import test from 'node:test';
import assert from 'node:assert/strict';
import { publishProductToOnlineStore } from '../../../../../../aws/src/providers/shopify/client.js';

const onlineStoreUrl = 'https://test-shop.myshopify.com/products/test-product';
const product = { id: 'gid://shopify/Product/123', title: 'Test product', handle: 'test-product', status: 'ACTIVE' };

async function withShopifyEnv(run: () => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const keys = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ACCESS_TOKEN'] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
}

test('publishes an ACTIVE product to Online Store without changing price, images or variants', async () => {
  await withShopifyEnv(async () => {
    let reads = 0;
    let writes = 0;
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith('/graphql.json')) {
        reads += 1;
        const request = JSON.parse(String(init?.body));
        assert.match(request.query, /onlineStoreUrl/);
        assert.deepEqual(request.variables, { id: product.id });
        return Response.json({ data: { product: { ...product, onlineStoreUrl: reads === 1 ? null : onlineStoreUrl } } });
      }
      writes += 1;
      assert.equal(String(input), 'https://test-shop.myshopify.com/admin/api/2024-04/products/123.json');
      assert.equal(init?.method, 'PUT');
      const request = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(request.product).sort(), ['id', 'published_at', 'published_scope']);
      assert.equal(request.product.id, 123);
      assert.equal(request.product.published_scope, 'web');
      assert.ok(!Number.isNaN(Date.parse(request.product.published_at)));
      return Response.json({ product: { id: 123, published_at: request.product.published_at } });
    };
    const result = await publishProductToOnlineStore(123);
    assert.equal(result.onlineStoreUrl, onlineStoreUrl);
    assert.equal(reads, 2);
    assert.equal(writes, 1);
  });
});

test('already-published products preserve their publication date without another write', async () => {
  await withShopifyEnv(async () => {
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls += 1;
      assert.ok(String(input).endsWith('/graphql.json'));
      assert.equal(init?.method, 'POST');
      return Response.json({ data: { product: { ...product, onlineStoreUrl } } });
    };
    assert.equal((await publishProductToOnlineStore(123)).onlineStoreUrl, onlineStoreUrl);
    assert.equal(calls, 1);
  });
});

test('drafts cannot be published by the publication-only operation', async () => {
  await withShopifyEnv(async () => {
    globalThis.fetch = async (input) => {
      assert.ok(String(input).endsWith('/graphql.json'));
      return Response.json({ data: { product: { ...product, status: 'DRAFT', onlineStoreUrl: null } } });
    };
    await assert.rejects(publishProductToOnlineStore(123), /must be active/);
  });
});

for (const scenario of ['denied', 'unconfirmed', 'missing-url'] as const) {
  test(`publication ${scenario} is reported as a failure, not a successful publish`, async () => {
    await withShopifyEnv(async () => {
      globalThis.fetch = async (input) => {
        if (String(input).endsWith('/graphql.json')) {
          return Response.json({ data: { product: { ...product, onlineStoreUrl: null } } });
        }
        if (scenario === 'denied') return Response.json({ errors: 'Access denied' }, { status: 403 });
        return Response.json({ product: { id: 123, published_at: scenario === 'unconfirmed' ? null : '2026-10-14T00:05:00.000Z' } });
      };
      const expected = scenario === 'denied' ? /HTTP 403/ : scenario === 'unconfirmed' ? /did not confirm/ : /URL is not available/;
      await assert.rejects(publishProductToOnlineStore(123), expected);
    });
  });
}

test('invalid publication IDs fail before any Shopify request', async () => {
  await assert.rejects(publishProductToOnlineStore(0), /positive integer/);
  await assert.rejects(publishProductToOnlineStore(Number.NaN), /positive integer/);
});
