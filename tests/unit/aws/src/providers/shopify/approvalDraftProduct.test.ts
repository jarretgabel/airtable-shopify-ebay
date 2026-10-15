import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopifyDraftProductFromApprovalFields,
  buildShopifyUnifiedProductSetRequest,
} from '../../../../../../aws/src/providers/shopify/approvalDraft.js';

test('Shopify approval draft defaults missing quantity to one and enables inventory tracking', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    'Shopify REST Title': 'Default Quantity Product',
  });
  const request = buildShopifyUnifiedProductSetRequest(product);

  assert.equal(product.variants?.[0]?.inventory_quantity, 1);
  assert.equal(product.variants?.[0]?.inventory_management, 'shopify');
  assert.equal(request.input.variants?.[0]?.inventoryItem?.tracked, true);
});

test('Shopify approval draft preserves an explicitly supplied zero quantity', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    'Shopify REST Title': 'Out Of Stock Product',
    Quantity: '0',
  });

  assert.equal(product.variants?.[0]?.inventory_quantity, 0);
});

test('Shopify legacy shipping weight reaches native create/update measurement without becoming a dimension', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    Title: 'Mark Levinson No 5802', 'Shipping Dims': '70lbs (27x25x12)',
  });
  for (const existingProductId of [undefined, 15430268879170]) {
    const request = buildShopifyUnifiedProductSetRequest(product, { existingProductId });
    assert.deepEqual(request.input.variants?.[0]?.inventoryItem?.measurement, {
      weight: { value: 70, unit: 'POUNDS' },
    });
    assert.deepEqual(request.input.metafields?.filter(({ key }) => key.startsWith('shipping_')).map(({ key, value }) => [key, value]), [
      ['shipping_width_inches', '27'], ['shipping_depth_inches', '25'], ['shipping_height_inches', '12'],
    ]);
  }
});

test('Shopify preserves canonical bare pounds, explicit zero, weight precedence and separate dimension precedence', () => {
  for (const weight of ['0', '80']) {
    const product = buildShopifyDraftProductFromApprovalFields({
      Title: 'Amp', 'Shipping Weight': weight, 'Shipping Dims': '70lbs (27x25x12)', 'Shipping Width': '30',
    });
    const request = buildShopifyUnifiedProductSetRequest(product);
    assert.deepEqual(request.input.variants?.[0]?.inventoryItem?.measurement, {
      weight: { value: Number(weight), unit: 'POUNDS' },
    });
    assert.equal(product.metafields?.find(({ key }) => key === 'shipping_width_inches')?.value, '30');
  }
  const product = buildShopifyDraftProductFromApprovalFields({
    Title: 'Amp', 'Shopify REST Variant 1 Weight': '4', 'Weight Unit': 'kg', 'Shipping Weight': '80',
  });
  assert.deepEqual(buildShopifyUnifiedProductSetRequest(product).input.variants?.[0]?.inventoryItem?.measurement, {
    weight: { value: 4, unit: 'KILOGRAMS' },
  });
});

test('Shopify respects supported embedded units and never infers weight from bare dimensions', () => {
  for (const [suffix, unit] of [
    ['lb', 'POUNDS'], ['lbs', 'POUNDS'], ['pounds', 'POUNDS'],
    ['kg', 'KILOGRAMS'], ['kilograms', 'KILOGRAMS'],
    ['g', 'GRAMS'], ['grams', 'GRAMS'], ['oz', 'OUNCES'], ['ounces', 'OUNCES'],
  ]) {
    for (const fields of [{ 'Shipping Weight': `2.5 ${suffix}` }, { 'Shipping Dims': `2.5${suffix} (27x25x12)` }]) {
      const product = buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', ...fields });
      assert.deepEqual(buildShopifyUnifiedProductSetRequest(product).input.variants?.[0]?.inventoryItem?.measurement, {
        weight: { value: 2.5, unit },
      });
    }
  }
  const product = buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', 'Shipping Dims': '27x25x12' });
  assert.equal(buildShopifyUnifiedProductSetRequest(product).input.variants?.[0]?.inventoryItem?.measurement, undefined);
});

test('Shopify preserves per-variant JSON weights on create/update without applying legacy weight to all variants', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    Title: 'Amp', 'Shipping Dims': '70lbs (27x25x12)',
    'Shopify REST Variants JSON': JSON.stringify([
      { sku: 'a', weight: 2, weight_unit: 'kg' }, { sku: 'b', weight: '16 ounces' }, { sku: 'c' },
    ]),
  });
  for (const existingProductId of [undefined, 123]) {
    assert.deepEqual(buildShopifyUnifiedProductSetRequest(product, { existingProductId }).input.variants?.map(
      (variant) => variant.inventoryItem?.measurement,
    ), [
      { weight: { value: 2, unit: 'KILOGRAMS' } }, { weight: { value: 16, unit: 'OUNCES' } }, undefined,
    ]);
  }
});

test('Shopify rejects invalid, conflicting and missing weight units instead of silently omitting measurement', () => {
  for (const fields of [
    { 'Shipping Weight': '-2' }, { 'Shipping Weight': 'NaN' }, { 'Shipping Weight': '12 damaged' },
    { 'Shipping Weight': '2 kg', 'Weight Unit': 'lb' }, { 'Shipping Weight': '2', 'Weight Unit': 'stones' },
    { 'Shipping Dims': '-70lbs (27x25x12)' }, { 'Shopify REST Variant 1 Weight': '2' },
    { 'Shopify REST Variants JSON': '[{"weight":2,"weight_unit":"stones"}]' },
    { 'Shopify REST Variants JSON': '[{"weight":2,"weight_unit":123}]' },
  ]) {
    assert.throws(() => buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', ...fields }), /weight/i);
  }
});
