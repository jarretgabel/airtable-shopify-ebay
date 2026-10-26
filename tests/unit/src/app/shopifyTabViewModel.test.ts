import { describe, expect, it } from 'vitest';
import { buildShopifyTabViewModel } from '@/app/appTabContentMappers';

const product = (id: number, sku: string) => ({ id, title: `p${id}`, variants: [{ sku }] }) as never;

describe('buildShopifyTabViewModel', () => {
  const base = { spLoading: false, spError: null, storeDomain: 'x.myshopify.com', nonEmptyListings: [] };

  it('shows products whose SKU belongs to a listed used-gear item', () => {
    const vm = buildShopifyTabViewModel({ ...base, products: [product(1, '10'), product(2, '20')], workflowListedSkus: new Set(['10']) });
    expect(vm.products.map((p) => (p as { id: number }).id)).toEqual([1]);
  });

  it('shows nothing when no SKU is eligible', () => {
    const vm = buildShopifyTabViewModel({ ...base, products: [product(1, '10')] });
    expect(vm.products).toEqual([]);
  });
});
