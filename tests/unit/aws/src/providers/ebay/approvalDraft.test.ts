import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEbayDraftPayloadBundleFromApprovalFields } from '../../../../../../aws/src/providers/ebay/approvalDraft.js';

test('prepared eBay image URLs override workflow source images', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    'eBay Inventory SKU': 'SKU-EPS-ONLY',
    'Workflow Image Metadata JSON': JSON.stringify([
      {
        url: 'https://drive.google.com/uc?export=view&id=source-image',
        includedInListing: true,
      },
    ]),
    'eBay Inventory Product Image URLs JSON': JSON.stringify([
      'https://i.ebayimg.com/images/g/first/s-l1600.jpg',
      'https://i.ebayimg.com/images/g/second/s-l1600.jpg',
    ]),
  });

  assert.deepEqual(bundle.inventoryItem.product?.imageUrls, [
    'https://i.ebayimg.com/images/g/first/s-l1600.jpg',
    'https://i.ebayimg.com/images/g/second/s-l1600.jpg',
  ]);
});

test('workflow images remain the fallback when prepared eBay images are absent', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    'eBay Inventory SKU': 'SKU-WORKFLOW-FALLBACK',
    'Workflow Image Metadata JSON': JSON.stringify([
      {
        url: 'https://drive.google.com/uc?export=view&id=source-image',
        filename: 'source-processed.jpg',
        includedInListing: true,
      },
    ]),
  });

  assert.deepEqual(bundle.inventoryItem.product?.imageUrls, [
    'https://drive.google.com/uc?export=view&id=source-image',
  ]);
});

test('workflow fallback images only include processed images selected for listing', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    'eBay Inventory SKU': 'SKU-PROCESSED-IMAGES',
    'Workflow Image Metadata JSON': JSON.stringify([
      {
        url: 'https://drive.google.com/uc?export=view&id=testing-original',
        filename: 'testing-1-original.jpg',
        includedInListing: true,
      },
      {
        url: 'https://drive.google.com/uc?export=view&id=testing-processed',
        filename: 'testing-1-processed.jpg',
        includedInListing: true,
      },
      {
        url: 'https://drive.google.com/uc?export=view&id=photos-photo-1',
        filename: 'photos-1.jpg',
        sourceStage: 'photos',
        includedInListing: true,
      },
      {
        url: 'https://drive.google.com/uc?export=view&id=intake',
        filename: 'intake-1-processed.jpg',
        sourceStage: 'intake',
        includedInListing: false,
      },
    ]),
  });

  assert.deepEqual(bundle.inventoryItem.product?.imageUrls, [
    'https://drive.google.com/uc?export=view&id=testing-processed',
    'https://drive.google.com/uc?export=view&id=photos-photo-1',
  ]);
});

test('maps canonical shipping fields to eBay package weight and dimensions', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    SKU: 'SKU-PACKAGE',
    'Shipping Weight': '5 lbs',
    'Shipping Dims': '20x18x 8',
  });

  assert.deepEqual(bundle.inventoryItem.packageWeightAndSize, {
    dimensions: { length: 20, width: 18, height: 8, unit: 'INCH' },
    weight: { value: 5, unit: 'POUND' },
  });
});

test('extracts weight and dimensions from combined shipping details', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    SKU: 'SKU-COMBINED-PACKAGE',
    'Shipping Dims': '22lbs (22x20x12)',
  });

  assert.deepEqual(bundle.inventoryItem.packageWeightAndSize, {
    dimensions: { length: 22, width: 20, height: 12, unit: 'INCH' },
    weight: { value: 22, unit: 'POUND' },
  });
});