import { buildShopifyDraftProductFromApprovalFields as frontendProduct } from '@/services/shopifyDraftFromAirtable';
import { buildShopifyUnifiedProductSetRequest as frontendRequest } from '@/services/shopify';
const product = frontendProduct;
const request = (fields: Record<string, unknown>, existingProductId?: number) =>
  frontendRequest(product(fields), { existingProductId });

describe('Shopify shipping mapping', () => {
  it.each([undefined, 15430268879170])('maps the reported legacy weight on create/update (%s)', (existingProductId) => {
    const result = request({ Title: 'Mark Levinson No 5802', 'Shipping Dims': '70lbs (27x25x12)' }, existingProductId);
    expect(result.input.variants?.[0]?.inventoryItem?.measurement).toEqual({
      weight: { value: 70, unit: 'POUNDS' },
    });
  });

  it('does not mistake the weight for the first legacy dimension', () => {
    const result = product({ Title: 'Amp', 'Shipping Dims': '70lbs (27x25x12)' });
    const dimensions = result.metafields?.filter(({ key }) => key.startsWith('shipping_'));
    expect(dimensions?.map(({ key, value }) => [key, value])).toEqual([
      ['shipping_width_inches', '27'], ['shipping_depth_inches', '25'], ['shipping_height_inches', '12'],
    ]);
  });

  it('preserves separate dimension precedence and does not assign a native package', () => {
    const result = request({ Title: 'Amp', 'Shipping Dims': '70lbs (27x25x12)', 'Shipping Width': '30' });
    expect(result.input.metafields?.find(({ key }) => key === 'shipping_width_inches')?.value).toBe('30');
    expect(result.input.variants?.[0]?.inventoryItem?.measurement).not.toHaveProperty('shippingPackageId');
  });

  it.each([
    ['lb', 'POUNDS'], ['pounds', 'POUNDS'], ['lbs', 'POUNDS'],
    ['kg', 'KILOGRAMS'], ['kilograms', 'KILOGRAMS'],
    ['g', 'GRAMS'], ['grams', 'GRAMS'], ['oz', 'OUNCES'], ['ounces', 'OUNCES'],
  ])('preserves the explicitly labeled %s unit', (unit, nativeUnit) => {
    expect(request({ Title: 'Amp', 'Shipping Dims': `2.5${unit} (27x25x12)` }).input.variants?.[0]?.inventoryItem?.measurement)
      .toEqual({ weight: { value: 2.5, unit: nativeUnit } });
    expect(request({ Title: 'Amp', 'Shipping Weight': `2.5 ${unit}` }).input.variants?.[0]?.inventoryItem?.measurement)
      .toEqual({ weight: { value: 2.5, unit: nativeUnit } });
  });

  it('preserves explicit weight precedence and the canonical bare-weight pounds default', () => {
    expect(request({ Title: 'Amp', 'Shipping Weight': '80', 'Shipping Dims': '70lbs (27x25x12)' })
      .input.variants?.[0]?.inventoryItem?.measurement).toEqual({ weight: { value: 80, unit: 'POUNDS' } });
    expect(request({
      Title: 'Amp', 'Shopify REST Variant 1 Weight': '4', 'Weight Unit': 'kg',
      'Shipping Weight': '80', 'Shipping Dims': '70lbs (27x25x12)',
    }).input.variants?.[0]?.inventoryItem?.measurement).toEqual({ weight: { value: 4, unit: 'KILOGRAMS' } });
  });

  it('does not replace an explicit zero weight or infer weight from bare dimensions', () => {
    expect(request({ Title: 'Amp', 'Shipping Weight': '0', 'Shipping Dims': '70lbs (27x25x12)' })
      .input.variants?.[0]?.inventoryItem?.measurement).toEqual({ weight: { value: 0, unit: 'POUNDS' } });
    expect(request({ Title: 'Amp', 'Shipping Dims': '27x25x12' })
      .input.variants?.[0]?.inventoryItem?.measurement).toBeUndefined();
  });

  it.each([undefined, 123])('preserves separate JSON variant weights on create/update (%s)', (existingProductId) => {
    const result = request({
      Title: 'Amp', 'Shipping Dims': '70lbs (27x25x12)',
      'Shopify REST Variants JSON': JSON.stringify([
        { sku: 'a', weight: 2, weight_unit: 'kg' },
        { sku: 'b', weight: '16 ounces' },
        { sku: 'c' },
      ]),
    }, existingProductId);
    expect(result.input.variants?.map((variant) => variant.inventoryItem?.measurement)).toEqual([
      { weight: { value: 2, unit: 'KILOGRAMS' } },
      { weight: { value: 16, unit: 'OUNCES' } },
      undefined,
    ]);
  });

  it.each([
    { 'Shipping Weight': '-2' },
    { 'Shipping Weight': 'NaN' },
    { 'Shipping Weight': '12 damaged' },
    { 'Shipping Weight': '2 kg', 'Weight Unit': 'lb' },
    { 'Shipping Weight': '2', 'Weight Unit': 'stones' },
    { 'Shipping Dims': '-70lbs (27x25x12)' },
    { 'Shopify REST Variant 1 Weight': '2' },
    { 'Shopify REST Variants JSON': '[{"weight":2,"weight_unit":"stones"}]' },
  ])('rejects invalid, conflicting, or missing weight units: %j', (fields) => {
    expect(() => request({ Title: 'Amp', ...fields })).toThrow(/weight/i);
  });
});
