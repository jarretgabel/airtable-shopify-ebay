import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSalePriceFields, formatShipTo, parseSaleBuyer } from './contracts/salePrice.js';

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

test('records buyer details once and ignores junk', () => {
  const buyer = parseSaleBuyer({ name: ' Ann ', email: 'a@x.com', shipTo: formatShipTo(['1 Main St', '', 'NYC', 'NY']), extra: 'x', phone: 5 });
  assert.deepEqual(buyer, { name: 'Ann', email: 'a@x.com', shipTo: '1 Main St, NYC, NY' });
  assert.equal(parseSaleBuyer('nope'), undefined);
  assert.deepEqual(buildSalePriceFields({ 'Buyer Name': 'Kept' }, { price: null, channel: 'eBay', buyer }), { 'Buyer Email': 'a@x.com', 'Buyer Ship To': '1 Main St, NYC, NY' });
});

