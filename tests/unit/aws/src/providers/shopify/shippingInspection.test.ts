import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { getProductShippingInspection } from '../../../../../../aws/src/providers/shopify/client.js';

function mockShopify(t: TestContext, response: Response) {
  const previousFetch = globalThis.fetch;
  const previousDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const previousToken = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  const requests: Array<{ query: string; variables: unknown }> = [];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return response;
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousDomain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN;
    else process.env.SHOPIFY_STORE_DOMAIN = previousDomain;
    if (previousToken === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN;
    else process.env.SHOPIFY_ACCESS_TOKEN = previousToken;
  });
  return requests;
}

function shippingData(truncated = false) {
  return {
    product: {
      id: 'gid://shopify/Product/123',
      variants: {
        nodes: [{
          id: 'gid://shopify/ProductVariant/456', sku: '11776',
          inventoryItem: {
            id: 'gid://shopify/InventoryItem/789', requiresShipping: true,
            measurement: { weight: { value: 0, unit: 'POUNDS' } },
          },
        }],
        pageInfo: { hasNextPage: truncated },
      },
      width: { value: '70.0', type: 'number_decimal' }, depth: null, height: null,
      legacyWidth: { value: '70.0', type: 'number_decimal' }, legacyDepth: null, legacyHeight: null,
    },
    widthDefinition: { nodes: [] }, depthDefinition: { nodes: [] }, heightDefinition: { nodes: [] },
    currentAppInstallation: { accessScopes: [{ handle: 'read_products' }] },
    measurementInput: { inputFields: [{ name: 'weight' }, { name: 'shippingPackageId' }] },
    inventoryItemInput: { inputFields: [{ name: 'measurement' }] },
    variantInput: { inputFields: [{ name: 'inventoryItem' }] },
    inventoryItemType: { fields: [{ name: 'measurement' }] },
    shopType: { fields: [{ name: 'name' }] },
    measurementType: { fields: [{ name: 'weight' }] },
    schema: { queryType: { fields: [{ name: 'product' }] }, mutationType: { fields: [{ name: 'productSet' }] } },
  };
}

test('shipping inspection reads native weight, custom dimensions, scopes and served version without mutations', async (t) => {
  const requests = mockShopify(t, Response.json({ data: shippingData() }, {
    headers: { 'x-shopify-api-version': '2025-10' },
  }));
  const result = await getProductShippingInspection(123);
  assert.equal(result?.servedApiVersion, '2025-10');
  assert.equal(result?.packageAssignmentSupported, true);
  assert.equal(result?.variantsTruncated, false);
  assert.deepEqual(result?.variants[0]?.inventoryItem.measurement.weight, { value: 0, unit: 'POUNDS' });
  assert.deepEqual(result?.dimensionMetafields.width, { value: '70.0', type: 'number_decimal' });
  assert.deepEqual(result?.accessScopes, ['read_products']);
  assert.deepEqual(result?.inventoryPackageFields, []);
  assert.deepEqual(result?.shopPackageFields, []);
  assert.deepEqual(result?.measurementPackageFields, []);
  assert.deepEqual(result?.packageQueries, []);
  assert.deepEqual(result?.packageMutations, []);
  assert.deepEqual(result?.packedSizeSchema, {
    measurementInputFields: ['weight', 'shippingPackageId'],
    inventoryItemInputFields: ['measurement'],
    variantInputFields: ['inventoryItem'],
    measurementOutputFields: ['weight'],
    inventoryItemOutputFields: ['measurement'],
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0].query, /^query InspectProductShipping/);
  assert.doesNotMatch(requests[0].query, /\bmutation\b/);
  assert.deepEqual(requests[0].variables, { id: 'gid://shopify/Product/123' });
});

test('shipping inspection explicitly marks bounded variant coverage and unknown served version', async (t) => {
  mockShopify(t, Response.json({ data: {
    ...shippingData(true), measurementInput: { inputFields: [{ name: 'weight' }] },
  } }));
  const result = await getProductShippingInspection(123);
  assert.equal(result?.variantsTruncated, true);
  assert.equal(result?.servedApiVersion, null);
  assert.equal(result?.packageAssignmentSupported, false);
});

test('shipping inspection returns null for a missing product', async (t) => {
  mockShopify(t, Response.json({ data: { ...shippingData(), product: null } }));
  assert.equal(await getProductShippingInspection(123), null);
});

test('shipping inspection surfaces Shopify errors instead of an empty successful audit', async (t) => {
  mockShopify(t, Response.json({ errors: [{ message: 'Access denied for measurement' }] }));
  await assert.rejects(getProductShippingInspection(123), /Access denied for measurement/);
});

test('shipping inspection requests definitions and distinguishes unstructured values from defined fields', async (t) => {
  const data = shippingData();
  const definition = { id: 'gid://shopify/MetafieldDefinition/1', name: 'Shipping depth' };
  const requests = mockShopify(t, Response.json({ data: {
    ...data,
    product: {
      ...data.product,
      width: { ...data.product.width, definition: null },
      depth: { value: '27.0', type: 'number_decimal', definition },
    },
  } }));
  const result = await getProductShippingInspection(123);
  assert.equal(requests[0].query.match(/definition\s*\{\s*id\s+name\s*\}/g)?.length, 6);
  assert.equal(result?.dimensionMetafields.width?.definition, null);
  assert.deepEqual(result?.dimensionMetafields.depth?.definition, definition);
  assert.equal(result?.dimensionMetafields.height, null);
  assert.deepEqual(result?.legacyDimensionMetafields?.width, data.product.legacyWidth);
  assert.deepEqual(result?.dimensionDefinitions, { width: null, depth: null, height: null });
});
