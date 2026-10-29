import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSalePriceFields } from './contracts/salePrice.js';

test('records the sale price and channel once', () => {
  assert.deepEqual(buildSalePriceFields({}, { price: 1234.5, channel: 'eBay' }), { 'Sale Price': 1234.5, 'Sold Via': 'eBay' });
  assert.deepEqual(buildSalePriceFields({ 'Sale Price': 900 }, { price: 1234.5, channel: 'eBay' }), {});
  assert.deepEqual(buildSalePriceFields({}, { price: null, channel: 'Shopify' }), {});
  assert.deepEqual(buildSalePriceFields({}, { price: Number.NaN, channel: 'Shopify' }), {});
});
