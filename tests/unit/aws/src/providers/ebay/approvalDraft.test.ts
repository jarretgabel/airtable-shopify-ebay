import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEbayDraftPayloadBundleFromApprovalFields } from '../../../../../../aws/src/providers/ebay/approvalDraft.js';

test('saved heavy-item fulfillment policy reaches the offer without changing weight or stock', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    SKU: '11751',
    'Shipping Dims': '100lbs (27x24x14)',
    Quantity: 1,
    'Ebay Price': 999999,
    'eBay Offer Fulfillment Policy ID': '331094759021',
  });

  assert.deepEqual(bundle.offer.listingPolicies, { fulfillmentPolicyId: '331094759021' });
  assert.deepEqual(bundle.inventoryItem.packageWeightAndSize?.weight, { value: 100, unit: 'POUND' });
  assert.equal(bundle.offer.availableQuantity, 1);
  assert.deepEqual(bundle.offer.pricingSummary, { price: { value: '999999', currency: 'USD' } });
});

for (const fields of [
  {
    'ebay_offer_fulfillment_policy_id': 'shipping',
    'e_bay_offer_paymentpolicyid': 'payment',
    'ebay_offer_returnpolicyid': 'returns',
  },
  {
    'Fulfillment Policy ID': 'shipping',
    'Payment Policy ID': 'payment',
    'Return Policy ID': 'returns',
  },
]) {
  test(`saved business policy aliases reach the server offer: ${Object.keys(fields).join(', ')}`, () => {
    assert.deepEqual(buildEbayDraftPayloadBundleFromApprovalFields(fields).offer.listingPolicies, {
      fulfillmentPolicyId: 'shipping', paymentPolicyId: 'payment', returnPolicyId: 'returns',
    });
  });
}

test('absent or blank per-listing policies leave default policy resolution unchanged', () => {
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    'eBay Offer Fulfillment Policy ID': ' ',
    'eBay Offer Payment Policy ID': '',
  });
  assert.equal(Object.hasOwn(bundle.offer, 'listingPolicies'), false);
});

for (const { fields, quantity } of [
  { fields: {}, quantity: 1 },
  { fields: { Quantity: '', Qty: ' ' }, quantity: 1 },
  { fields: { 'eBay Inventory Ship To Location Quantity': 0, Quantity: 4, Qty: 5 }, quantity: 0 },
  { fields: { Quantity: '0', Qty: 5 }, quantity: 0 },
  { fields: { Qty: 0 }, quantity: 0 },
  { fields: { 'eBay Inventory Ship To Location Quantity': '3', Quantity: 4 }, quantity: 3 },
  { fields: { Quantity: 4, Qty: 5, 'eBay Offer Quantity Limit Per Buyer': 99 }, quantity: 4 },
]) {
  test(`quantity precedence and zero reach both payload destinations: ${JSON.stringify(fields)}`, () => {
    const bundle = buildEbayDraftPayloadBundleFromApprovalFields(fields);
    assert.deepEqual(bundle.inventoryItem.availability, { shipToLocationAvailability: { quantity } });
    assert.equal(bundle.offer.availableQuantity, quantity);
  });
}

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
test('eBay product aspects leave out values over 65 characters and unverified [CHECK] values', () => {
  const longValue = 'Multiple conductor gauges and lengths wound so frequency components arrive simultaneously';
  const bundle = buildEbayDraftPayloadBundleFromApprovalFields({
    SKU: '1',
    Make: 'MIT',
    Model: 'MI-330',
    'Key Features (Key, Value)': JSON.stringify([
      { feature: 'Vari-Lay Geometry', value: longValue },
      { feature: 'Terminations', value: 'RCA [CHECK]' },
      { feature: 'Length', value: '1 meter' },
    ]),
  });

  const aspects = bundle.inventoryItem.product?.aspects as Record<string, string[]>;
  assert.deepEqual(aspects.Length, ['1 meter']);
  assert.equal(aspects['Vari-Lay Geometry'], undefined);
  assert.equal(aspects.Terminations, undefined);
  assert.deepEqual(aspects.Brand, ['MIT']);
});
