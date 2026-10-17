import test from 'node:test';
import assert from 'node:assert/strict';
import { planShippingCleanup, planShippingRecord, planShippingRestore, planWeightFormat } from '../../../../../../aws/src/shared/contracts/shippingDimsCleanup.js';
import { buildShopifyDraftProductFromApprovalFields, buildShopifyUnifiedProductSetRequest } from '../../../../../../aws/src/providers/shopify/approvalDraft.js';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '../../../../../../aws/src/providers/ebay/approvalDraft.js';

const plan = (dims: string, existing: { weight?: string; shippingWeight?: string } = {}) =>
  planShippingCleanup({ 'Shipping Dims': dims, Weight: existing.weight, 'Shipping Weight': existing.shippingWeight });

test('splits a single package into weight and dimensions', () => {
  const expected = { kind: 'update', fields: { Weight: '70 lbs', 'Shipping Dims': '27x25x12' } };
  for (const raw of ['70lbs (27x25x12)', '70 lbs (27x25x12)', ' 70LBS  (27X25X12) ', '70lbs ((27x25x12)', '70 lb (27x25x12)', '70 pounds (27x25x12)', '70lbs. (27x25x12)', '70lbs 27x25x12', '70lbs (27x25x12")']) {
    assert.deepEqual(plan(raw), expected, raw);
  }
  assert.deepEqual(plan('1lbs (10x6x3)'), { kind: 'update', fields: { Weight: '1 lbs', 'Shipping Dims': '10x6x3' } });
  assert.deepEqual(plan('12.5lbs (24x20x12.5)'), { kind: 'update', fields: { Weight: '12.5 lbs', 'Shipping Dims': '24x20x12.5' } });
});

test('a weight-only value moves to Weight and leaves dimensions empty', () => {
  assert.deepEqual(plan('130lbs'), { kind: 'update', fields: { Weight: '130 lbs', 'Shipping Dims': '' } });
});

test('already-clean, empty and non-combined values are left alone', () => {
  assert.deepEqual(plan('27x25x12'), { kind: 'skip', reason: 'already-clean' });
  assert.deepEqual(plan('20"x18"x10"'), { kind: 'skip', reason: 'already-clean' });
  assert.deepEqual(plan(''), { kind: 'skip', reason: 'empty' });
  assert.deepEqual(plan('   '), { kind: 'skip', reason: 'empty' });
});

test('multi-package, ambiguous and free-text values are never guessed at', () => {
  const multi = ['2 boxes @ 80lbs (48x20x20) each', '2@ 60lbs (48x20x20)', '70 lbs (48x20x20) x 2 Boxes', '1@ 47lbs (24x20x20), 1@ 45lbs (30x20x20)', '2 boxes - 90lbs (28x23x17), 8lbs (24x20x8)', '230lbs (32x26x40) / 40x48 pallet 46" tall'];
  for (const raw of multi) assert.deepEqual(plan(raw), { kind: 'review', reason: 'multi-package' }, raw);
  for (const raw of ['180 (48x40x54)', '140(26x26x26)', '40 (24x20x20)', '90lbs (need mcintosh box)', 'Flate rate freight box', '34lns (24x20x11)', '10lb6 (18x12x8)', '24x20', '(24x20x18)']) {
    assert.deepEqual(plan(raw), { kind: 'review', reason: 'unrecognized' }, raw);
  }
});

test('implausible numbers are reviewed instead of written', () => {
  assert.deepEqual(plan('0lbs (10x6x3)'), { kind: 'review', reason: 'implausible-values' });
  assert.deepEqual(plan('5000lbs (10x6x3)'), { kind: 'review', reason: 'implausible-values' });
  assert.deepEqual(plan('50lbs (500x6x3)'), { kind: 'review', reason: 'implausible-values' });
});

test('an existing weight must agree; a matching one is kept and only the dimensions are cleaned', () => {
  assert.deepEqual(plan('70lbs (27x25x12)', { weight: '70 lbs' }), { kind: 'update', fields: { 'Shipping Dims': '27x25x12' } });
  assert.deepEqual(plan('70lbs (27x25x12)', { weight: '70' }), { kind: 'update', fields: { 'Shipping Dims': '27x25x12' } });
  assert.deepEqual(plan('70lbs (27x25x12)', { shippingWeight: '70lbs' }), { kind: 'update', fields: { 'Shipping Dims': '27x25x12' } });
  assert.deepEqual(plan('70lbs (27x25x12)', { weight: '65 lbs' }), { kind: 'review', reason: 'weight-conflict' });
  assert.deepEqual(plan('70lbs (27x25x12)', { weight: '70 lbs', shippingWeight: '80' }), { kind: 'review', reason: 'weight-conflict' });
  assert.deepEqual(plan('70lbs (27x25x12)', { weight: 'about heavy' }), { kind: 'review', reason: 'weight-conflict' });
  assert.deepEqual(plan('130lbs', { weight: '130 lbs' }), { kind: 'update', fields: { 'Shipping Dims': '' } });
});

test('cleaning never changes what Shopify or eBay would publish', () => {
  const samples: Array<[string, Record<string, string>]> = [
    ['70lbs (27x25x12)', {}], ['1lbs (10x6x3)', {}], ['70lbs 27x25x12', {}], ['12.5lbs (24x20x12.5)', {}],
    ['45lbs ((27x25x12)', {}], ['130lbs', {}], ['70lbs (27x25x12)', { Weight: '70 lbs' }], ['500lbs 48x40x60', {}],
  ];
  const publishView = (fields: Record<string, unknown>) => {
    const product = buildShopifyDraftProductFromApprovalFields({ Title: 'Amp', ...fields });
    const request = buildShopifyUnifiedProductSetRequest(product);
    return {
      measurement: request.input.variants?.[0]?.inventoryItem?.measurement ?? null,
      shipping: (request.input.metafields ?? []).filter(({ key }) => key.startsWith('shipping_')).map(({ key, value }) => [key, value]),
      ebay: (buildEbayDraftPayloadBundleFromApprovalFields({ Title: 'Amp', ...fields }).inventoryItem as { packageWeightAndSize?: unknown }).packageWeightAndSize ?? null,
    };
  };

  for (const [raw, existing] of samples) {
    const result = planShippingCleanup({ 'Shipping Dims': raw, ...existing });
    assert.equal(result.kind, 'update', raw);
    const cleaned = { ...existing, ...(result as { fields: Record<string, string> }).fields };
    assert.deepEqual(publishView(cleaned), publishView({ 'Shipping Dims': raw, ...existing }), raw);
  }
});

test('undo restores the originals only when the record still holds exactly what the cleanup wrote', () => {
  const original = { Weight: null, 'Shipping Weight': null, 'Shipping Dims': '46lbs (23x21x9)' };
  const restoreFields = { Weight: '', 'Shipping Weight': '', 'Shipping Dims': '46lbs (23x21x9)' };

  assert.deepEqual(planShippingRestore(original, { Weight: '46 lbs', 'Shipping Dims': '23x21x9' }), { kind: 'restore', fields: restoreFields });
  assert.deepEqual(planShippingRestore(original, { Weight: '46 lbs', 'Shipping Dims': '23x21x9', 'Shipping Weight': '' }), { kind: 'restore', fields: restoreFields });

  assert.deepEqual(planShippingRestore(original, { 'Shipping Dims': '46lbs (23x21x9)' }), { kind: 'skip', reason: 'already-original' });
  assert.deepEqual(planShippingRestore(original, { Weight: '50 lbs', 'Shipping Dims': '23x21x9' }), { kind: 'skip', reason: 'changed-since-cleanup' });
  assert.deepEqual(planShippingRestore(original, { Weight: '46 lbs', 'Shipping Dims': '24x21x9' }), { kind: 'skip', reason: 'changed-since-cleanup' });

  const withWeight = { Weight: '130 lbs', 'Shipping Weight': null, 'Shipping Dims': '130lbs' };
  assert.deepEqual(planShippingRestore(withWeight, { Weight: '130 lbs', 'Shipping Dims': '' }), { kind: 'restore', fields: { Weight: '130 lbs', 'Shipping Weight': '', 'Shipping Dims': '130lbs' } });

  const keptWeight = { Weight: '70 lbs', 'Shipping Weight': null, 'Shipping Dims': '70lbs (27x25x12)' };
  assert.deepEqual(planShippingRestore(keptWeight, { Weight: '70 lbs', 'Shipping Dims': '27x25x12' }), { kind: 'restore', fields: { Weight: '70 lbs', 'Shipping Weight': '', 'Shipping Dims': '70lbs (27x25x12)' } });
});

test('weights are normalized to "N lbs" and anything else is reported, not changed', () => {
  const fix = (weight?: string, shippingWeight?: string) => planWeightFormat({ Weight: weight, 'Shipping Weight': shippingWeight });

  assert.deepEqual(fix('46 lbs'), { fields: {}, freeText: [] });
  assert.deepEqual(fix('20lbs'), { fields: { Weight: '20 lbs' }, freeText: [] });
  assert.deepEqual(fix('30 LBS'), { fields: { Weight: '30 lbs' }, freeText: [] });
  assert.deepEqual(fix('20'), { fields: { Weight: '20 lbs' }, freeText: [] });
  assert.deepEqual(fix(undefined, '15 lbs.'), { fields: { 'Shipping Weight': '15 lbs' }, freeText: [] });
  assert.deepEqual(fix('12.50 lb'), { fields: { Weight: '12.5 lbs' }, freeText: [] });
  assert.deepEqual(fix('22lbs', '6'), { fields: { Weight: '22 lbs', 'Shipping Weight': '6 lbs' }, freeText: [] });

  for (const raw of ['50 lbs each', '6lbs & 20 lbs', '45 lbs, 40lbs', '48, 43, 20 lbs', 'totaling 250 lbs', '60 & 45 lbs']) {
    assert.deepEqual(fix(raw), { fields: {}, freeText: ['Weight'] }, raw);
  }
  assert.deepEqual(fix('0'), { fields: {}, freeText: [] });
  assert.deepEqual(fix('5000 lbs'), { fields: {}, freeText: [] });
  assert.deepEqual(fix(), { fields: {}, freeText: [] });
});

test('a record plan combines the dimensions split with weight formatting, and undo recognizes the combined result', () => {
  const plan = planShippingRecord({ 'Shipping Dims': '70lbs (27x25x12)', Weight: '70lbs' });
  assert.deepEqual(plan.fields, { 'Shipping Dims': '27x25x12', Weight: '70 lbs' });

  const multi = planShippingRecord({ 'Shipping Dims': '2@ 60lbs (48x20x20)', Weight: '20lbs' });
  assert.deepEqual(multi.fields, { Weight: '20 lbs' });
  assert.deepEqual(multi.dims, { kind: 'review', reason: 'multi-package' });

  const original = { Weight: '70lbs', 'Shipping Weight': null, 'Shipping Dims': '70lbs (27x25x12)' };
  assert.deepEqual(planShippingRestore(original, { Weight: '70 lbs', 'Shipping Dims': '27x25x12' }), { kind: 'restore', fields: { Weight: '70lbs', 'Shipping Weight': '', 'Shipping Dims': '70lbs (27x25x12)' } });

  const weightOnly = { Weight: '20lbs', 'Shipping Weight': null, 'Shipping Dims': null };
  assert.deepEqual(planShippingRestore(weightOnly, { Weight: '20 lbs' }), { kind: 'restore', fields: { Weight: '20lbs', 'Shipping Weight': '', 'Shipping Dims': '' } });
});

test('formatting a weight never changes what Shopify or eBay would publish', () => {
  const publishWeight = (weight: string) => ({
    shopify: buildShopifyUnifiedProductSetRequest(buildShopifyDraftProductFromApprovalFields({ Title: 'A', Weight: weight })).input.variants?.[0]?.inventoryItem?.measurement,
    ebay: (buildEbayDraftPayloadBundleFromApprovalFields({ Title: 'A', Weight: weight }).inventoryItem as { packageWeightAndSize?: { weight?: unknown } }).packageWeightAndSize?.weight,
  });
  for (const raw of ['20lbs', '30 LBS', '20', '12.50 lb', '15 lbs.']) {
    const fixed = planWeightFormat({ Weight: raw }).fields.Weight;
    const before = raw === '15 lbs.' ? { ebay: publishWeightSafe(raw) } : publishWeight(raw);
    assert.deepEqual(raw === '15 lbs.' ? { ebay: publishWeight(fixed).ebay } : publishWeight(fixed), before, raw);
  }

  function publishWeightSafe(raw: string) { return (buildEbayDraftPayloadBundleFromApprovalFields({ Title: 'A', Weight: raw }).inventoryItem as { packageWeightAndSize?: { weight?: unknown } }).packageWeightAndSize?.weight; }
});

test('undo still recognizes records written by the earlier dimensions-only cleanup', () => {
  const original = { Weight: '70lbs', 'Shipping Weight': null, 'Shipping Dims': '70lbs (27x25x12)' };
  assert.deepEqual(planShippingRestore(original, { Weight: '70lbs', 'Shipping Dims': '27x25x12' }), { kind: 'restore', fields: { Weight: '70lbs', 'Shipping Weight': '', 'Shipping Dims': '70lbs (27x25x12)' } });
});
