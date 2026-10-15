import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { updateProductShipping } from '../../../../../../aws/src/providers/shopify/client.js';

const shipping = { variantId: 456, weightPounds: 70, widthInches: 27, depthInches: 25, heightInches: 12 };
const dimensionsOnly = { variantId: 456, widthInches: 27, depthInches: 25, heightInches: 12 };
type Scenario = 'success' | 'dimensions-only' | 'new-values' | 'wrong-definition' | 'missing-definition' | 'weight-error' | 'weight-http-error' | 'dimensions-error' | 'readback-http-error' | 'bad-readback' | 'wrong-variant' | 'wrong-product' | 'truncated' | 'wrong-type' | 'no-digest';
interface Request { query: string; variables: Record<string, unknown> }

function mockShopify(t: TestContext, scenario: Scenario = 'success') {
  const originalFetch = globalThis.fetch;
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  const requests: Request[] = [];
  let reads = 0;
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Request;
    requests.push(request);
    if (request.query.startsWith('query InspectProductShipping')) {
      reads += 1;
      const after = reads > 1;
      if (after && scenario === 'readback-http-error') return Response.json({}, { status: 503 });
      const dimension = (axis: string, before: string, updated: string) => ({
        value: after ? updated : before,
        type: scenario === 'wrong-type' ? 'single_line_text_field' : 'number_decimal',
        compareDigest: scenario === 'no-digest' ? undefined : `digest-${axis}`,
        definition: after ? { id: `gid://shopify/MetafieldDefinition/${axis}`, name: `Shipping ${axis} inches` } : null,
      });
      return Response.json({ data: {
        product: {
          id: scenario === 'wrong-product' ? 'gid://shopify/Product/999' : 'gid://shopify/Product/123',
          variants: {
            nodes: [{
              id: scenario === 'wrong-variant' ? 'gid://shopify/ProductVariant/999' : 'gid://shopify/ProductVariant/456',
              sku: '11776',
              inventoryItem: {
                id: 'gid://shopify/InventoryItem/789', requiresShipping: true,
                measurement: { weight: { value: after && scenario !== 'dimensions-only' ? (scenario === 'bad-readback' ? 69 : 70) : 0, unit: 'POUNDS' } },
              },
            }],
            pageInfo: { hasNextPage: scenario === 'truncated' },
          },
          width: !after && scenario === 'new-values' ? null : dimension('width', '70.0', '27.0'),
          depth: !after && scenario === 'new-values' ? null : dimension('depth', '27.0', '25.0'),
          height: !after && scenario === 'new-values' ? null : dimension('height', '25.0', '12.0'),
          legacyWidth: { value: '27.0', type: 'number_decimal' },
          legacyDepth: { value: '25.0', type: 'number_decimal' },
          legacyHeight: { value: '12.0', type: 'number_decimal' },
        },
        ...Object.fromEntries(['width', 'depth', 'height'].map((axis) => [`${axis}Definition`, {
          nodes: scenario === 'missing-definition' ? [] : [{
            id: `gid://shopify/MetafieldDefinition/${axis}`, name: `Shipping ${axis} inches`,
            type: { name: scenario === 'wrong-definition' ? 'dimension' : 'number_decimal' },
          }],
        }])),
        currentAppInstallation: { accessScopes: [] },
        schema: { queryType: { fields: [] }, mutationType: null },
      } }, { headers: { 'x-shopify-api-version': '2025-10' } });
    }
    if (request.query.startsWith('mutation UpdateProductShippingWeight')) {
      if (scenario === 'weight-http-error') return Response.json({}, { status: 503 });
      return Response.json({ data: { inventoryItemUpdate: {
        inventoryItem: { id: 'gid://shopify/InventoryItem/789', measurement: { weight: { value: 70, unit: 'POUNDS' } } },
        userErrors: scenario === 'weight-error' ? [{ message: 'Weight denied' }] : [],
      } } });
    }
    if (request.query.startsWith('mutation UpdateProductShippingDimensions')) {
      return Response.json({ data: { metafieldsSet: {
        metafields: [],
        userErrors: scenario === 'dimensions-error' ? [{ message: 'compareDigest mismatch' }] : [],
      } } });
    }
    throw new Error(`Unexpected request: ${request.query}`);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
    else process.env.SHOPIFY_STORE_DOMAIN = domain;
    if (token === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN;
    else process.env.SHOPIFY_ACCESS_TOKEN = token;
  });
  return requests;
}

test('shipping update sends only native measurement and three CAS-protected custom dimensions, then verifies readback', async (t) => {
  const requests = mockShopify(t);
  const result = await updateProductShipping(123, shipping);
  assert.equal(result.variants[0].inventoryItem.measurement.weight?.value, 70);
  assert.equal(result.dimensionMetafields.width?.value, '27.0');
  const mutations = requests.filter(({ query }) => query.startsWith('mutation'));
  assert.equal(mutations.length, 2);
  assert.deepEqual(mutations[0].variables, {
    id: 'gid://shopify/InventoryItem/789',
    input: { measurement: { weight: { value: 70, unit: 'POUNDS' } } },
  });
  assert.deepEqual(mutations[1].variables, { metafields: [
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_width_inches', type: 'number_decimal', value: '27', compareDigest: 'digest-width' },
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_depth_inches', type: 'number_decimal', value: '25', compareDigest: 'digest-depth' },
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_height_inches', type: 'number_decimal', value: '12', compareDigest: 'digest-height' },
  ] });
  assert.equal(requests.length, 4);
  assert.doesNotMatch(mutations.map(({ query, variables }) => query + JSON.stringify(variables)).join('\n'),
    /productSet|inventoryQuantities|inventory_quantity|shippingPackageId|price|images|publish|definitionCreate/);
});

for (const scenario of ['wrong-variant', 'wrong-product', 'truncated', 'wrong-type', 'no-digest', 'wrong-definition', 'missing-definition'] as const) {
  test(`shipping update refuses ${scenario} before any mutation`, async (t) => {
    const requests = mockShopify(t, scenario);
    await assert.rejects(updateProductShipping(123, shipping), { statusCode: 409 });
    assert.equal(requests.filter(({ query }) => query.startsWith('mutation')).length, 0);
  });
}

test('shipping update rejects invalid inputs before contacting Shopify', async (t) => {
  const requests = mockShopify(t);
  for (const value of [
    null, {}, { ...shipping, variantId: '456' }, { ...shipping, weightPounds: -1 },
    { ...shipping, widthInches: 0 }, { ...shipping, depthInches: Infinity },
    { ...shipping, heightInches: '12' }, { ...shipping, inventory_quantity: 1 },
  ]) {
    await assert.rejects(updateProductShipping(123, value), { statusCode: 400 });
  }
  await assert.rejects(updateProductShipping(-1, shipping), { statusCode: 400 });
  assert.equal(requests.length, 0);
});

test('shipping update stops before dimensions if native weight is rejected', async (t) => {
  const requests = mockShopify(t, 'weight-error');
  await assert.rejects(updateProductShipping(123, shipping), /custom dimensions were not written.*Weight denied/);
  assert.equal(requests.filter(({ query }) => query.startsWith('mutation')).length, 1);
});

test('shipping update reports partial writes explicitly when dimension CAS fails after native weight', async (t) => {
  mockShopify(t, 'dimensions-error');
  await assert.rejects(updateProductShipping(123, shipping), /Native weight was updated.*compareDigest mismatch/);
});

test('shipping update never reports success when final readback differs', async (t) => {
  mockShopify(t, 'bad-readback');
  await assert.rejects(updateProductShipping(123, shipping), /exact values could not be verified/);
});

test('shipping update reports uncertain native write outcomes without attempting dimensions', async (t) => {
  const requests = mockShopify(t, 'weight-http-error');
  await assert.rejects(updateProductShipping(123, shipping), /may have changed the weight; custom dimensions were not written/);
  assert.equal(requests.filter(({ query }) => query.startsWith('mutation')).length, 1);
});

test('shipping update explicitly reports writes when the final verification request fails', async (t) => {
  mockShopify(t, 'readback-http-error');
  await assert.rejects(updateProductShipping(123, shipping), /Shipping writes were attempted but readback failed/);
});

test('dimensions-only copy writes new keys without changing native weight or legacy fields', async (t) => {
  const requests = mockShopify(t, 'dimensions-only');
  const result = await updateProductShipping(123, dimensionsOnly);
  assert.equal(result.variants[0].inventoryItem.measurement.weight?.value, 0);
  assert.equal(result.legacyDimensionMetafields?.width?.value, '27.0');
  const mutations = requests.filter(({ query }) => query.startsWith('mutation'));
  assert.equal(mutations.length, 1);
  assert.match(mutations[0].query, /metafieldsSet/);
  assert.doesNotMatch(JSON.stringify(mutations), /inventoryItemUpdate|"key":"shipping_(?:width|depth|height)"/);
  assert.equal(requests.length, 3);
});

test('dimensions-only readback detects an unexpected native weight change', async (t) => {
  const requests = mockShopify(t, 'success');
  await assert.rejects(updateProductShipping(123, dimensionsOnly), /exact values could not be verified/);
  assert.equal(requests.filter(({ query }) => query.startsWith('mutation')).length, 1);
});

test('dimensions-only failures do not claim that native weight was written', async (t) => {
  mockShopify(t, 'dimensions-error');
  await assert.rejects(updateProductShipping(123, dimensionsOnly), /Native weight was left unchanged, but custom dimensions were not confirmed/);
});

test('new canonical values use compareDigest null rather than a legacy field digest', async (t) => {
  const requests = mockShopify(t, 'new-values');
  await updateProductShipping(123, shipping);
  const variables = requests.find(({ query }) => query.includes('mutation UpdateProductShippingDimensions'))?.variables;
  assert.deepEqual(variables, { metafields: [
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_width_inches', type: 'number_decimal', value: '27', compareDigest: null },
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_depth_inches', type: 'number_decimal', value: '25', compareDigest: null },
    { ownerId: 'gid://shopify/Product/123', namespace: 'custom', key: 'shipping_height_inches', type: 'number_decimal', value: '12', compareDigest: null },
  ] });
});
