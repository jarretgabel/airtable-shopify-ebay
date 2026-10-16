import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retainSoldShopifyProduct, type SoldRetentionDependencies } from '../../../../../aws/src/services/soldRetention.js';
import type { ShopifyProductSaleState } from '../../../../../aws/src/providers/shopify/client.js';

type Variant = ShopifyProductSaleState['variants'][number];

function variant(overrides: Partial<Variant> = {}): Variant {
  return { id: 'gid://shopify/ProductVariant/1', sku: '11776', position: 1, inventoryPolicy: 'DENY', inventoryQuantity: 1, tracked: true, ...overrides };
}

function state(overrides: Partial<ShopifyProductSaleState> = {}): ShopifyProductSaleState {
  return { id: 123, status: 'ACTIVE', tags: ['Amplifier', 'Used'], totalInventory: 1, variantsTruncated: false, variants: [variant()], ...overrides };
}

interface Harness {
  deps: SoldRetentionDependencies;
  calls: Array<{ op: string; args: unknown[] }>;
}

// Simulates a live product: reads reflect earlier writes so the service's readback can be verified.
function harness(initial: ShopifyProductSaleState | null, options: { failOn?: 'zero' | 'deny' | 'tag' | 'read'; failRetryable?: boolean; zeroIgnored?: boolean } = {}): Harness {
  const current = initial ? structuredClone(initial) : null;
  const calls: Harness['calls'] = [];
  const fail = (op: 'zero' | 'deny' | 'tag' | 'read') => {
    if (options.failOn === op) {
      throw Object.assign(new Error(`${op} failed`), { retryable: options.failRetryable ?? true });
    }
  };
  const deps: SoldRetentionDependencies = {
    getProductSaleState: async (...args) => {
      calls.push({ op: 'read', args });
      fail('read');
      return current ? structuredClone(current) : null;
    },
    syncProductVariantInventoryLevels: async (...args) => {
      calls.push({ op: 'zero', args });
      fail('zero');
      if (current && !options.zeroIgnored) {
        current.totalInventory = 0;
        current.variants.forEach((entry) => { entry.inventoryQuantity = 0; });
      }
    },
    denyVariantOversell: async (...args) => {
      calls.push({ op: 'deny', args });
      fail('deny');
      current?.variants.forEach((entry) => { entry.inventoryPolicy = 'DENY'; });
    },
    addProductTags: async (...args) => {
      calls.push({ op: 'tag', args });
      fail('tag');
      if (current) current.tags = [...current.tags, ...(args[1] as string[])];
    },
  };
  return { deps, calls };
}

const writes = (calls: Harness['calls']) => calls.filter(({ op }) => op !== 'read').map(({ op }) => op);

describe('retainSoldShopifyProduct', () => {
  describe('sold on eBay', () => {
    it('keeps the product, zeroes stock, forbids overselling and adds sold-archive without replacing other tags', async () => {
      const { deps, calls } = harness(state({ variants: [variant({ inventoryPolicy: 'CONTINUE' })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, true);
      assert.equal(result.outcome, 'retained');
      assert.deepEqual(writes(calls), ['zero', 'deny', 'tag']);
      assert.deepEqual(calls.find(({ op }) => op === 'zero')?.args, [123, [{ sku: '11776', position: 1, quantity: 0 }]]);
      assert.deepEqual(calls.find(({ op }) => op === 'tag')?.args, [123, ['sold-archive']]);
    });

    it('never deletes the product: no delete operation exists in the dependencies', () => {
      const { deps } = harness(state());
      assert.deepEqual(Object.keys(deps).sort(), ['addProductTags', 'denyVariantOversell', 'getProductSaleState', 'syncProductVariantInventoryLevels']);
    });

    it('does not touch the overselling policy when it is already DENY', async () => {
      const { deps, calls } = harness(state());
      await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);
      assert.deepEqual(writes(calls), ['zero', 'tag']);
    });

    it('is idempotent: an already retained product causes no writes', async () => {
      const { deps, calls } = harness(state({ tags: ['Amplifier', 'Sold-Archive'], totalInventory: 0, variants: [variant({ inventoryQuantity: 0 })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, true);
      assert.equal(result.outcome, 'already-retained');
      assert.deepEqual(writes(calls), []);
    });

    it('recovers a partial earlier run: stock already zero but tag missing only adds the tag', async () => {
      const { deps, calls } = harness(state({ totalInventory: 0, variants: [variant({ inventoryQuantity: 0 })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.outcome, 'retained');
      assert.deepEqual(writes(calls), ['tag']);
    });

    it('leaves a multi-unit product untouched and flags it for review', async () => {
      const { deps, calls } = harness(state({ totalInventory: 3, variants: [variant({ inventoryQuantity: 3 })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, true);
      assert.equal(result.outcome, 'needs-review');
      assert.match(result.message, /3 in stock/);
      assert.deepEqual(writes(calls), []);
    });

    it('leaves a product with untracked inventory untouched and flags it for review', async () => {
      const { deps, calls } = harness(state({ totalInventory: null, variants: [variant({ tracked: false, inventoryQuantity: null })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.outcome, 'needs-review');
      assert.match(result.message, /not tracked/i);
      assert.deepEqual(writes(calls), []);
    });

    it('leaves a product with more than one page of variants untouched and flags it for review', async () => {
      const { deps, calls } = harness(state({ variantsTruncated: true }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.outcome, 'needs-review');
      assert.deepEqual(writes(calls), []);
    });
  });

  describe('sold on Shopify', () => {
    it('does not change stock (Shopify already did); it forbids overselling and adds the tag', async () => {
      const { deps, calls } = harness(state({ totalInventory: 0, variants: [variant({ inventoryQuantity: 0, inventoryPolicy: 'CONTINUE' })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'shopify' }, deps);

      assert.equal(result.outcome, 'retained');
      assert.deepEqual(writes(calls), ['deny', 'tag']);
    });

    it('does not tag a product that still has stock after the sale', async () => {
      const { deps, calls } = harness(state({ totalInventory: 2, variants: [variant({ inventoryQuantity: 2 })] }));
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'shopify' }, deps);

      assert.equal(result.outcome, 'needs-review');
      assert.match(result.message, /2 still in stock/);
      assert.deepEqual(writes(calls), []);
    });
  });

  describe('failures', () => {
    it('treats a missing product as nothing to retain, without writes', async () => {
      const { deps, calls } = harness(null);
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, true);
      assert.equal(result.outcome, 'skipped-no-product');
      assert.deepEqual(writes(calls), []);
    });

    it('rejects an invalid product id before any call', async () => {
      const { deps, calls } = harness(state());
      for (const productId of [0, -1, Number.NaN, 1.5]) {
        const result = await retainSoldShopifyProduct({ productId, soldOn: 'ebay' }, deps);
        assert.equal(result.success, false);
        assert.equal(result.retryable, false);
      }
      assert.equal(calls.length, 0);
    });

    for (const failOn of ['read', 'zero', 'deny', 'tag'] as const) {
      it(`reports a retryable ${failOn} failure so the webhook can be retried`, async () => {
        const { deps } = harness(state({ variants: [variant({ inventoryPolicy: 'CONTINUE' })] }), { failOn, failRetryable: true });
        const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

        assert.equal(result.success, false);
        assert.equal(result.outcome, 'failed');
        assert.equal(result.retryable, true);
        assert.match(result.message, new RegExp(`${failOn} failed`));
      });
    }

    it('marks a permanent failure as not retryable', async () => {
      const { deps } = harness(state(), { failOn: 'tag', failRetryable: false });
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, false);
      assert.equal(result.retryable, false);
    });

    it('treats missing credentials as a permanent configuration failure, not something to retry', async () => {
      const { deps } = harness(state());
      deps.getProductSaleState = async () => { throw new Error('Missing required environment variable: SHOPIFY_ACCESS_TOKEN'); };
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, false);
      assert.equal(result.retryable, false);
    });

    it('never reports success when the readback shows stock was not zeroed', async () => {
      const { deps } = harness(state(), { zeroIgnored: true });
      const result = await retainSoldShopifyProduct({ productId: 123, soldOn: 'ebay' }, deps);

      assert.equal(result.success, false);
      assert.equal(result.outcome, 'failed');
      assert.match(result.message, /could not be verified/i);
    });
  });
});
