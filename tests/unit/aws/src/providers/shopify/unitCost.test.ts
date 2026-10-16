import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopifyDraftProductFromApprovalFields,
  buildShopifyUnifiedProductSetRequest,
} from '../../../../../../aws/src/providers/shopify/approvalDraft.js';
import {
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
  type ShopifyUnifiedProductSetRequest,
} from '../../../../../../aws/src/providers/shopify/client.js';

const costOf = (fields: Record<string, unknown>, existingProductId?: number) => buildShopifyUnifiedProductSetRequest(
  buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', 'Shopify Price': 1999, Quantity: 1, ...fields }),
  { existingProductId },
).input.variants?.[0]?.inventoryItem?.cost;

test('intake Cost maps to the private inventory-item cost on create and update', () => {
  for (const existingProductId of [undefined, 15430268879170]) {
    assert.equal(costOf({ Cost: 125.5 }, existingProductId), '125.50');
    assert.equal(costOf({ Cost: '1500' }, existingProductId), '1500.00');
  }
});

test('blank Cost is omitted so an existing Shopify cost is preserved; explicit zero is sent', () => {
  for (const existingProductId of [undefined, 123]) {
    assert.equal(costOf({}, existingProductId), undefined);
    assert.equal(costOf({ Cost: '' }, existingProductId), undefined);
    assert.equal(costOf({ Cost: 0 }, existingProductId), '0.00');
  }
});

test('Cost never changes the selling price, stock or compare-at price', () => {
  const without = buildShopifyUnifiedProductSetRequest(buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', 'Shopify Price': 1999, Quantity: 1 }));
  const withCost = buildShopifyUnifiedProductSetRequest(buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', 'Shopify Price': 1999, Quantity: 1, Cost: 1500 }));
  const strip = (request: ShopifyUnifiedProductSetRequest) => {
    const variant = { ...request.input.variants?.[0], inventoryItem: { ...request.input.variants?.[0]?.inventoryItem } };
    delete variant.inventoryItem.cost;
    return variant;
  };
  assert.deepEqual(strip(withCost), strip(without));
  assert.equal(withCost.input.variants?.[0]?.price, '1999.00');
});

test('invalid Cost values are rejected by the draft builder instead of being altered or dropped', () => {
  for (const Cost of [-5, '-0.01', 'abc', '125.555']) {
    assert.throws(
      () => buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', Cost }),
      (error: unknown) => (error as { statusCode?: number; code?: string }).statusCode === 400
        && (error as { code?: string }).code === 'INVALID_SHOPIFY_UNIT_COST'
        && /unit cost/i.test((error as Error).message),
    );
  }
});

test('record Cost is not blanket-copied onto explicit multi-variant JSON', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    Title: 'Amp', Cost: 900,
    'Shopify REST Variants JSON': JSON.stringify([{ sku: 'a', unit_cost: '10' }, { sku: 'b' }]),
  });
  assert.deepEqual(
    buildShopifyUnifiedProductSetRequest(product).input.variants?.map((variant) => variant.inventoryItem?.cost),
    ['10.00', undefined],
  );
});

interface Recorded { query: string; variables: { input: { variants: Array<{ inventoryItem: Record<string, unknown> }> } } }

function mockShopify(t: TestContext, options: { unitCost?: { amount: string; currencyCode: string } | null; readbackStatus?: number } = {}) {
  const originalFetch = globalThis.fetch;
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'test-token';
  const requests: Recorded[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as Recorded;
    requests.push(request);
    if (request.query.startsWith('query ReadVariantUnitCosts')) {
      if (options.readbackStatus) return Response.json({}, { status: options.readbackStatus });
      return Response.json({ data: { product: { variants: { nodes: [{ sku: '11776', inventoryItem: { unitCost: options.unitCost === undefined ? { amount: '125.50', currencyCode: 'USD' } : options.unitCost } }] } } } });
    }
    return Response.json({ data: { productSet: { product: { id: 'gid://shopify/Product/123', title: 'Amp', status: 'ACTIVE' }, userErrors: [], collectionJoin0: { userErrors: [] } } } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (domain === undefined) delete process.env.SHOPIFY_STORE_DOMAIN; else process.env.SHOPIFY_STORE_DOMAIN = domain;
    if (token === undefined) delete process.env.SHOPIFY_ACCESS_TOKEN; else process.env.SHOPIFY_ACCESS_TOKEN = token;
  });
  return requests;
}

const requestWithCost = (cost: unknown): ShopifyUnifiedProductSetRequest => ({
  synchronous: true,
  input: { title: 'Amp', variants: [{ optionValues: [], sku: '11776', inventoryItem: { sku: '11776', cost: cost as string } }] },
});

test('upsert sends the cost and reports no warning when the readback matches in USD', async (t) => {
  const requests = mockShopify(t);
  const result = await upsertProductWithUnifiedRequest(requestWithCost('125.5'));
  assert.equal(requests[0].variables.input.variants[0].inventoryItem.cost, '125.50');
  assert.equal(requests.length, 2);
  assert.equal(result.warnings, undefined);
});

test('upsert without a cost performs no readback and sends no cost field', async (t) => {
  const requests = mockShopify(t);
  const request = requestWithCost(undefined);
  delete request.input.variants![0].inventoryItem!.cost;
  const result = await upsertProductWithUnifiedRequest(request);
  assert.equal(requests.length, 1);
  assert.equal('cost' in requests[0].variables.input.variants[0].inventoryItem, false);
  assert.equal(result.warnings, undefined);
});

test('a client-supplied invalid cost is rejected before any Shopify request', async (t) => {
  const requests = mockShopify(t);
  for (const cost of ['-5', 'abc', '125.555']) {
    await assert.rejects(upsertProductWithUnifiedRequest(requestWithCost(cost)), { statusCode: 400, code: 'INVALID_SHOPIFY_UNIT_COST' });
    await assert.rejects(upsertExistingProductWithCollectionsInSingleMutation({ ...requestWithCost(cost), identifier: { id: 'gid://shopify/Product/123' } }, []), { statusCode: 400 });
  }
  assert.equal(requests.length, 0);
});

test('a readback mismatch, wrong currency, missing cost or failed readback warns without failing the saved product', async (t) => {
  for (const [options, pattern] of [
    [{ unitCost: { amount: '99.00', currencyCode: 'USD' } }, /read back as 99\.00 USD instead of 125\.50/],
    [{ unitCost: { amount: '125.50', currencyCode: 'CAD' } }, /stored in CAD, not USD/],
    [{ unitCost: null }, /could not be confirmed/],
    [{ readbackStatus: 503 }, /could not be read back/],
  ] as const) {
    mockShopify(t, options);
    const result = await upsertProductWithUnifiedRequest(requestWithCost('125.50'));
    assert.equal(result.id, 123);
    assert.match(result.warnings?.[0] ?? '', pattern);
  }
});
