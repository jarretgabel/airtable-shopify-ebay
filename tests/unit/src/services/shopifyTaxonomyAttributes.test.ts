import { describe, expect, it } from 'vitest';
import {
  buildShopifyTaxonomyChoiceMetafields,
  parseShopifyTaxonomyAttributes,
  serializeShopifyTaxonomyAttributes,
} from '@/services/shopifyTaxonomyAttributes';

describe('Shopify taxonomy attribute contract', () => {
  it('round-trips the canonical ID-preserving document', () => {
    const document = {
      version: 1 as const,
      categoryId: 'gid://shopify/TaxonomyCategory/el-2-2-2',
      categoryFullName: 'Electronics > Audio > Audio Amplifiers',
      attributes: [{
        id: 'gid://shopify/TaxonomyAttribute/1',
        name: 'Color',
        type: 'choice' as const,
        values: [{ id: 'gid://shopify/TaxonomyValue/1', name: 'Black' }],
      }],
    };

    expect(parseShopifyTaxonomyAttributes(serializeShopifyTaxonomyAttributes(document))).toEqual(document);
  });

  it('maps only live definition-backed choice IDs to native Shopify metafields', () => {
    const document = {
      version: 1 as const,
      categoryId: 'gid://shopify/TaxonomyCategory/el-2-2-2',
      categoryFullName: 'Electronics > Audio > Audio Amplifiers',
      attributes: [{
        id: 'gid://shopify/TaxonomyAttribute/1',
        name: 'Color',
        type: 'choice' as const,
        values: [
          { id: 'gid://shopify/TaxonomyValue/1', name: 'Black' },
          { id: 'gid://shopify/TaxonomyValue/stale', name: 'Stale' },
        ],
      }],
    };

    expect(buildShopifyTaxonomyChoiceMetafields(document, [{
      id: 'gid://shopify/TaxonomyAttribute/1',
      name: 'Color',
      type: 'choice',
      values: [{ id: 'gid://shopify/TaxonomyValue/1', name: 'Black' }],
    }])).toEqual([{
      namespace: 'shopify',
      key: 'color',
      type: 'list.metaobject_reference',
      value: '["gid://shopify/TaxonomyValue/1"]',
    }]);
  });

  it('rejects malformed or wrong-version JSON', () => {
    expect(parseShopifyTaxonomyAttributes('{"version":2}')).toBeNull();
    expect(parseShopifyTaxonomyAttributes('{not-json')).toBeNull();
  });
});
