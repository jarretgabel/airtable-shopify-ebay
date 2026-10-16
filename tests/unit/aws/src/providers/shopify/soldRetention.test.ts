import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { addProductTags, denyVariantOversell, getProductSaleState } from '../../../../../../aws/src/providers/shopify/client.js';

interface Recorded { query: string; variables: Record<string, unknown> }

function mockShopify(t: TestContext, respond: (request: Recorded) => unknown, status = 200) {
  const originalFetch = globalThis.fetch;
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  const requests: Recorded[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Recorded;
    requests.push(request);
    return Response.json(respond(request), { status });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN; else process.env.SHOPIFY_STORE_DOMAIN = domain;
    if (token === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN; else process.env.SHOPIFY_ACCESS_TOKEN = token;
  });
  return requests;
}

const productNode = {
  id: 'gid://shopify/Product/123', status: 'ACTIVE', tags: ['Amplifier', 'Used'], totalInventory: 1,
  variants: {
    nodes: [{ id: 'gid://shopify/ProductVariant/456', sku: '11776', position: 1, inventoryPolicy: 'DENY', inventoryQuantity: 1, inventoryItem: { tracked: true } }],
    pageInfo: { hasNextPage: false },
  },
};

test('getProductSaleState reads status, tags, stock, policy and tracking in one query without mutating', async (t) => {
  const requests = mockShopify(t, () => ({ data: { product: productNode } }));
  const state = await getProductSaleState(123);

  assert.deepEqual(state, {
    id: 123, status: 'ACTIVE', tags: ['Amplifier', 'Used'], totalInventory: 1, variantsTruncated: false,
    variants: [{ id: 'gid://shopify/ProductVariant/456', sku: '11776', position: 1, inventoryPolicy: 'DENY', inventoryQuantity: 1, tracked: true }],
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /^query GetProductSaleState/);
  assert.doesNotMatch(requests[0].query, /mutation/);
  assert.deepEqual(requests[0].variables, { id: 'gid://shopify/Product/123' });
});

test('getProductSaleState reports truncated variants and returns null for a missing product', async (t) => {
  mockShopify(t, () => ({ data: { product: { ...productNode, variants: { ...productNode.variants, pageInfo: { hasNextPage: true } } } } }));
  assert.equal((await getProductSaleState(123))?.variantsTruncated, true);

  mockShopify(t, () => ({ data: { product: null } }));
  assert.equal(await getProductSaleState(123), null);
});

test('addProductTags only appends via tagsAdd and never uses a replacing mutation', async (t) => {
  const requests = mockShopify(t, () => ({ data: { tagsAdd: { userErrors: [] } } }));
  await addProductTags(123, [' sold-archive ', 'sold-archive', '']);

  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /tagsAdd/);
  assert.doesNotMatch(requests[0].query, /productSet|productUpdate|tagsRemove/);
  assert.deepEqual(requests[0].variables, { id: 'gid://shopify/Product/123', tags: ['sold-archive'] });
});

test('addProductTags and denyVariantOversell make no request when there is nothing to write', async (t) => {
  const requests = mockShopify(t, () => ({ data: {} }));
  await addProductTags(123, ['', '  ']);
  await denyVariantOversell(123, []);
  assert.equal(requests.length, 0);
});

test('denyVariantOversell sets only the inventory policy of the given variants', async (t) => {
  const requests = mockShopify(t, () => ({ data: { productVariantsBulkUpdate: { userErrors: [] } } }));
  await denyVariantOversell(123, ['gid://shopify/ProductVariant/456']);

  assert.match(requests[0].query, /productVariantsBulkUpdate/);
  assert.deepEqual(requests[0].variables, {
    productId: 'gid://shopify/Product/123',
    variants: [{ id: 'gid://shopify/ProductVariant/456', inventoryPolicy: 'DENY' }],
  });
});

test('Shopify user errors are surfaced as non-retryable failures instead of being swallowed', async (t) => {
  mockShopify(t, () => ({ data: { tagsAdd: { userErrors: [{ message: 'Tag is invalid' }] }, productVariantsBulkUpdate: { userErrors: [{ message: 'Policy rejected' }] } } }));

  await assert.rejects(addProductTags(123, ['sold-archive']), { code: 'SHOPIFY_TAGS_ADD_FAILED', retryable: false, message: 'Tag is invalid' });
  await assert.rejects(denyVariantOversell(123, ['v']), { code: 'SHOPIFY_VARIANT_POLICY_FAILED', retryable: false, message: 'Policy rejected' });
});

test('server errors from Shopify are retryable and invalid product ids fail before any request', async (t) => {
  const requests = mockShopify(t, () => ({}), 503);
  await assert.rejects(getProductSaleState(123), { retryable: true });

  requests.length = 0;
  for (const id of [0, -5, Number.NaN, 1.5]) {
    await assert.rejects(getProductSaleState(id), { statusCode: 400 });
    await assert.rejects(addProductTags(id, ['x']), { statusCode: 400 });
    await assert.rejects(denyVariantOversell(id, ['x']), { statusCode: 400 });
  }
  assert.equal(requests.length, 0);
});
