import test from 'node:test';
import assert from 'node:assert/strict';
import { executeApprovalPublish } from './publish.js';

test('executeApprovalPublish passes merged field overrides to both shopify and ebay execution paths', async () => {
  const shopifyCalls: Array<Record<string, unknown>> = [];
  const normalizeCalls: Array<Record<string, unknown>> = [];

  const result = await executeApprovalPublish({
    target: 'both',
    source: 'approval-combined',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
    fields: {
      Title: 'Edited title',
      Price: '199.99',
    },
  }, {
    publishApprovalListingToShopify: async (input) => {
      shopifyCalls.push(input as unknown as Record<string, unknown>);
      return {
        productId: '99',
        mode: 'updated',
        warnings: [],
        wroteProductId: false,
        staleProductIdCleared: false,
      };
    },
    getConfiguredRecord: async () => ({
      id: 'rec123',
      createdTime: 'now',
      fields: {
        Title: 'Original title',
        SKU: 'ABC123',
      },
    }),
    normalizeApprovalFields: async (input) => {
      normalizeCalls.push(input as unknown as Record<string, unknown>);
      return {
        target: 'both',
        shopify: {
          draftProduct: { title: 'Edited title' },
          effectiveProduct: { title: 'Edited title' },
          tagValues: ['vintage'],
          collectionIds: ['gid://shopify/Collection/2'],
          bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Edited title</p>' },
          productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Edited title' },
          productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
          categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
          categoryLookupValue: 'Amplifiers',
          categoryResolution: { status: 'resolved', match: null, error: '' },
          resolvedCategoryId: 'gid://shopify/TaxonomyCategory/1',
          productSetRequest: { input: { title: 'Edited title' }, synchronous: true },
        },
        ebay: {
          generatedBodyHtml: '<p>Edited title</p>',
          draftPayloadBundle: {
            inventoryItem: { sku: 'ABC123' },
            offer: { sku: 'ABC123' },
          },
        },
      };
    },
    buildEbayDraftPayloadBundleFromApprovalFields: () => {
      throw new Error('should not build eBay bundle when normalized preview is available');
    },
    pushApprovalBundleToEbay: async () => ({
      sku: 'ABC123',
      offerId: 'offer-1',
      listingId: 'listing-1',
      wasExistingOffer: false,
    }),
  });

  assert.deepEqual(shopifyCalls, [{
    source: 'approval-combined',
    recordId: 'rec123',
    productIdFieldName: 'Shopify REST Product ID',
    fields: {
      Title: 'Edited title',
      SKU: 'ABC123',
      Price: '199.99',
    },
    preview: {
      draftProduct: { title: 'Edited title' },
      effectiveProduct: { title: 'Edited title' },
      tagValues: ['vintage'],
      collectionIds: ['gid://shopify/Collection/2'],
      bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Edited title</p>' },
      productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Edited title' },
      productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
      categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
      categoryLookupValue: 'Amplifiers',
      categoryResolution: { status: 'resolved', match: null, error: '' },
      resolvedCategoryId: 'gid://shopify/TaxonomyCategory/1',
      productSetRequest: { input: { title: 'Edited title' }, synchronous: true },
    },
  }]);
  assert.deepEqual(normalizeCalls, [{
    target: 'both',
    fields: {
      Title: 'Edited title',
      SKU: 'ABC123',
      Price: '199.99',
    },
  }]);
  assert.equal(result.shopify?.productId, '99');
  assert.equal(result.ebay?.listingId, 'listing-1');
});