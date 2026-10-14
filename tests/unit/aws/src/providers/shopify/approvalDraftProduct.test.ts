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
