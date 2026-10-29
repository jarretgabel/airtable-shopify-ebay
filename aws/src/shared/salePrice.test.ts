import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSalePriceFields } from './contracts/salePrice.js';

test('records the sale price and channel once', () => {
  assert.deepEqual(buildSalePriceFields({}, { price: 1234.5, channel: 'eBay' }), { 'Sale Price': 1234.5, 'Sold Via': 'eBay' });
  assert.deepEqual(buildSalePriceFields({ 'Sale Price': 900 }, { price: 1234.5, channel: 'eBay' }), {});
  assert.deepEqual(buildSalePriceFields({}, { price: null, channel: 'Shopify' }), {});
  assert.deepEqual(buildSalePriceFields({}, { price: Number.NaN, channel: 'Shopify' }), {});
  assert.deepEqual(
    buildSalePriceFields({}, { price: 10, channel: 'Shopify', soldAt: '2026-10-20T15:00:00Z' }),
    { 'Sold At': '2026-10-20', 'Sale Price': 10, 'Sold Via': 'Shopify' },
  );
  assert.deepEqual(buildSalePriceFields({ 'Sold At': '2026-01-01' }, { price: null, channel: 'eBay', soldAt: '2026-10-20' }), {});
});
