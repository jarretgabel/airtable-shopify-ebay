import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
  type ShopifyUnifiedProductSetRequest,
} from '../../../../../../aws/src/providers/shopify/client.js';

interface Recorded { query: string; variables: Record<string, unknown> }

function mockShopify(t: TestContext, options: { tags?: string[]; readStatus?: number } = {}) {
  const originalFetch = globalThis.fetch;
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  const requests: Recorded[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Recorded;
    requests.push(request);
    if (request.query.startsWith('query GetProductSaleState')) {
      if (options.readStatus) return Response.json({}, { status: options.readStatus });
      return Response.json({ data: { product: {
        id: 'gid://shopify/Product/123', status: 'ACTIVE', tags: options.tags ?? [], totalInventory: 0,
        variants: { nodes: [], pageInfo: { hasNextPage: false } },
      } } });
    }
    return Response.json({ data: { productSet: { product: { id: 'gid://shopify/Product/123', title: 'Amp', status: 'ACTIVE' }, userErrors: [] }, collectionJoin0: { userErrors: [] } } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN; else process.env.SHOPIFY_STORE_DOMAIN = domain;
    if (token === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN; else process.env.SHOPIFY_ACCESS_TOKEN = token;
  });
  const mutations = () => requests.filter(({ query }) => query.includes('mutation'));
  const reads = () => requests.filter(({ query }) => query.startsWith('query GetProductSaleState'));
  return { requests, mutations, reads };
}

const update: ShopifyUnifiedProductSetRequest = { synchronous: true, identifier: { id: 'gid://shopify/Product/123' }, input: { title: 'Amp', tags: ['Amplifier', 'Used'] } };
const create: ShopifyUnifiedProductSetRequest = { synchronous: true, input: { title: 'Amp' } };

test('an update of a sold-archive product is refused before any write, so it cannot restock or untag the item', async (t) => {
  const { mutations, reads } = mockShopify(t, { tags: ['Amplifier', 'sold-archive'] });

  await assert.rejects(upsertProductWithUnifiedRequest(update), { statusCode: 409, code: 'SHOPIFY_PRODUCT_SOLD_ARCHIVED', retryable: false });
  assert.equal(reads().length, 1);
  assert.equal(mutations().length, 0);
});

test('the sold-archive check is case-insensitive', async (t) => {
  const { mutations } = mockShopify(t, { tags: ['Sold-Archive'] });
  await assert.rejects(upsertProductWithUnifiedRequest(update), { code: 'SHOPIFY_PRODUCT_SOLD_ARCHIVED' });
  assert.equal(mutations().length, 0);
});

test('the refusal explains how to relist deliberately', async (t) => {
  mockShopify(t, { tags: ['sold-archive'] });
  await assert.rejects(upsertProductWithUnifiedRequest(update), /sold-archive.*No changes made/s);
});

test('an update of a product that is not sold proceeds normally', async (t) => {
  const { mutations, reads } = mockShopify(t, { tags: ['Amplifier', 'Used'] });

  const result = await upsertProductWithUnifiedRequest(update);

  assert.equal(result.id, 123);
  assert.equal(reads().length, 1);
  assert.equal(mutations().length, 1);
});

test('creating a product makes no extra read', async (t) => {
  const { reads, mutations } = mockShopify(t, { tags: ['sold-archive'] });

  await upsertProductWithUnifiedRequest(create);

  assert.equal(reads().length, 0);
  assert.equal(mutations().length, 1);
});

test('the combined update-with-collections path is guarded as well', async (t) => {
  const { mutations } = mockShopify(t, { tags: ['sold-archive'] });

  await assert.rejects(
    upsertExistingProductWithCollectionsInSingleMutation(update, ['gid://shopify/Collection/1']),
    { statusCode: 409, code: 'SHOPIFY_PRODUCT_SOLD_ARCHIVED' },
  );
  assert.equal(mutations().length, 0);
});

test('the combined path without collections checks once, not twice', async (t) => {
  const { reads } = mockShopify(t, { tags: [] });
  await upsertExistingProductWithCollectionsInSingleMutation(update, []);
  assert.equal(reads().length, 1);
});

test('if the sold state cannot be read, the update is not attempted', async (t) => {
  const { mutations } = mockShopify(t, { readStatus: 503 });

  await assert.rejects(upsertProductWithUnifiedRequest(update), { retryable: true });
  assert.equal(mutations().length, 0);
});
