import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApprovalFields } from './normalize.js';

test('normalizeApprovalFields composes shopify and ebay preview results for combined target', async () => {
  const result = await normalizeApprovalFields({
    target: 'both',
    fields: { Title: 'Amp' },
    bodyPreview: {
      templateHtml: '<html>{{title}}</html>',
      title: 'Amp',
      description: 'Great amp',
      keyFeatures: 'Power:100W',
    },
    categoryPreview: {
      labelsById: {
        '3276': 'Amplifiers & Preamps',
      },
    },
  }, {
    buildShopifyApprovalPreviewFromFields: async (fields) => ({
      draftProduct: { title: String(fields.Title ?? '') },
      effectiveProduct: { title: String(fields.Title ?? '') },
      tagValues: ['vintage', 'amp'],
      collectionIds: [],
      collectionLabelsById: { 'gid://shopify/Collection/2': 'Amplifiers' },
      bodyHtmlResolution: { sourceFieldName: 'Body HTML', sourceType: 'exact', value: '<p>Amp</p>' },
      productDescriptionResolution: { sourceFieldName: 'Description', sourceType: 'exact', value: 'Great amp' },
      productCategoryResolution: { sourceFieldName: 'Category', sourceType: 'exact', value: 'Amplifiers' },
      categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
      categoryLookupValue: 'Amplifiers',
      categoryResolution: { status: 'resolved', match: null, error: '' },
      productSetRequest: { input: { title: 'Amp' }, synchronous: true },
    }),
    buildEbayApprovalPreviewFromFields: (fields, bodyPreview, categoryPreview) => ({
      generatedBodyHtml: `${String(fields.Title ?? '')}:${bodyPreview?.title ?? ''}`,
      draftPayloadBundle: {
        inventoryItem: { sku: 'ABC123' },
        offer: { sku: 'ABC123' },
      },
      selectedCategoryIds: ['3276'],
      selectedCategoryNames: [categoryPreview?.labelsById?.['3276'] ?? ''],
      categoryFieldUpdates: { 'Primary Category Name': categoryPreview?.labelsById?.['3276'] ?? '' },
    }),
  });

  assert.equal(result.shopify?.effectiveProduct.title, 'Amp');
  assert.deepEqual(result.shopify?.tagValues, ['vintage', 'amp']);
  assert.deepEqual(result.shopify?.collectionLabelsById, { 'gid://shopify/Collection/2': 'Amplifiers' });
  assert.equal(result.ebay?.generatedBodyHtml, 'Amp:Amp');
  assert.deepEqual(result.ebay?.categoryFieldUpdates, { 'Primary Category Name': 'Amplifiers & Preamps' });
});