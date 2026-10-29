import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSaleAlertEmail } from './saleAlert.js';

test('builds a sale alert with listing links and results', () => {
  const { subject, body } = buildSaleAlertEmail({
    channel: 'Shopify',
    action: 'Sale (order paid)',
    recordId: 'rec1',
    fields: { 'Item Title': 'McIntosh MC275', SKU: '123', 'eBay Listing ID': '999' },
    orderId: 'gid://shopify/Order/55',
    orderName: '#1001',
    shopifyProductId: 'gid://shopify/Product/77',
    results: ['eBay close: ok - withdrawn'],
  }, { appBaseUrl: 'https://app.example/', shopDomain: 'shop.myshopify.com' });

  assert.equal(subject, '[Shopify] Sale (order paid): McIntosh MC275');
  assert.match(body, /https:\/\/app\.example\/listings\/rec1/);
  assert.match(body, /https:\/\/www\.ebay\.com\/itm\/999/);
  assert.match(body, /https:\/\/shop\.myshopify\.com\/admin\/products\/77/);
  assert.match(body, /https:\/\/shop\.myshopify\.com\/admin\/orders\/55/);
  assert.match(body, /eBay close: ok/);
});
