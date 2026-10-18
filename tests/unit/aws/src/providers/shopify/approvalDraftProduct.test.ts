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

test('Used items are tagged Pre-Owned Hifi after their own tags, once, and other conditions are not', () => {
  const tagsFor = (fields: Record<string, unknown>) => buildShopifyDraftProductFromApprovalFields({ 'Shopify REST Title': 'T', ...fields }).tags;

  assert.equal(tagsFor({ Condition: 'Used' }), 'Pre-Owned Hifi');
  assert.equal(tagsFor({ __Condition__: 'Used', 'Shopify Tags': 'Amplifier, Mark Levinson' }), 'Amplifier, Mark Levinson, Pre-Owned Hifi');
  assert.equal(tagsFor({ 'eBay Inventory Condition': 'USED_EXCELLENT', Tags: 'Amplifier' }), 'Amplifier, Pre-Owned Hifi');
  assert.equal(tagsFor({ Condition: 'Used', 'Shopify Tags': 'pre-owned hifi, Amplifier' }), 'pre-owned hifi, Amplifier');

  assert.equal(tagsFor({ Condition: 'New', 'Shopify Tags': 'Amplifier' }), 'Amplifier');
  assert.equal(tagsFor({ Condition: 'Open Box' }), undefined);
  assert.equal(tagsFor({ Condition: 'For parts or not working' }), undefined);
  assert.equal(tagsFor({}), undefined);
});

test('Shopify SEO fields reach productSet as seo, not as global metafields', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    'Shopify REST Title': 'SEO Product',
    'Shopify Extra SEO Title': 'Leben CS300 Tube Integrated Amplifier',
    'Shopify Extra SEO Description': 'Pre-owned Leben CS300 tube integrated amplifier, tested and ready to hear in Brooklyn.',
  });
  const request = buildShopifyUnifiedProductSetRequest(product);

  assert.deepEqual(request.input.seo, {
    title: 'Leben CS300 Tube Integrated Amplifier',
    description: 'Pre-owned Leben CS300 tube integrated amplifier, tested and ready to hear in Brooklyn.',
  });
  assert.equal(request.input.metafields?.some((metafield) => metafield.namespace === 'global'), false);
});

test('Shopify productSet omits seo when the SEO fields are empty', () => {
  const request = buildShopifyUnifiedProductSetRequest(
    buildShopifyDraftProductFromApprovalFields({ 'Shopify REST Title': 'No SEO Product' }),
  );
  assert.equal(request.input.seo, undefined);
});

test('Shopify body renders key features saved in the shared Key Features (Key, Value) field with automatic mappings', () => {
  const product = buildShopifyDraftProductFromApprovalFields({
    'Shopify REST Title': 'Key Features Product',
    Description: 'A warm tube amp.',
    'Serial Number': 'SN123',
    'Key Features (Key, Value)': JSON.stringify([{ feature: 'Tube Complement', value: '4x EL34' }]),
  });

  assert.match(product.body_html ?? '', /Tube Complement<\/th><td>4x EL34/);
  assert.match(product.body_html ?? '', /Serial Number<\/th><td>SN123/);
});
