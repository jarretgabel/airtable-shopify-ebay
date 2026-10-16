import test from 'node:test';
import assert from 'node:assert/strict';
import { parseShopifyUnitCost } from '../../../../../aws/src/shared/contracts/shopifyUnitCost.js';

test('blank or missing cost is omitted so an existing Shopify cost is preserved', () => {
  for (const value of [undefined, null, '', '   ', '$', ' $ ']) {
    assert.deepEqual(parseShopifyUnitCost(value), {});
  }
});

test('valid per-unit costs are normalized to two decimals without conversion', () => {
  assert.deepEqual(parseShopifyUnitCost(125.5), { cost: '125.50' });
  assert.deepEqual(parseShopifyUnitCost('125.5'), { cost: '125.50' });
  assert.deepEqual(parseShopifyUnitCost('1500'), { cost: '1500.00' });
  assert.deepEqual(parseShopifyUnitCost('$1,500.00'), { cost: '1500.00' });
  assert.deepEqual(parseShopifyUnitCost(1500), { cost: '1500.00' });
});

test('explicit zero is a valid cost, not a blank', () => {
  assert.deepEqual(parseShopifyUnitCost(0), { cost: '0.00' });
  assert.deepEqual(parseShopifyUnitCost('0'), { cost: '0.00' });
  assert.deepEqual(parseShopifyUnitCost('0.00'), { cost: '0.00' });
});

test('negative, malformed, non-finite and over-precise costs are rejected instead of altered', () => {
  for (const value of [-1, '-5', '-0.01', 'abc', '12abc', '1.2.3', '125.555', Number.NaN, Infinity, {}, [], true]) {
    const result = parseShopifyUnitCost(value);
    assert.equal(result.cost, undefined, `cost for ${JSON.stringify(value)}`);
    assert.match(result.error ?? '', /non-negative dollar amount/);
  }
});
