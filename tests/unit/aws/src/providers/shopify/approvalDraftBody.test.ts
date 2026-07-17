import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShopifyBodyHtml } from '../../../../../../aws/src/providers/shopify/approvalDraftBody.js';

test('resolveShopifyBodyHtml prefers generated template body when description/key-features are present', () => {
  const value = resolveShopifyBodyHtml({
    'Shopify REST Body HTML': '<p>Rendered body from Shopify field</p>',
    Description: 'Description that would otherwise be rendered',
    'Key Features JSON': JSON.stringify([
      { feature: 'Power', value: '100W' },
    ]),
  });

  assert.match(value, /Description that would otherwise be rendered/);
  assert.match(value, /Power/);
  assert.match(value, /100W/);
});

test('resolveShopifyBodyHtml falls back to generated body when rendered html field is missing', () => {
  const value = resolveShopifyBodyHtml({
    Description: 'Generated fallback description',
    'Key Features JSON': JSON.stringify([
      { feature: 'Power', value: '100W' },
    ]),
  });

  assert.match(value, /Generated fallback description/);
  assert.match(value, /<ul>/);
});

test('resolveShopifyBodyHtml falls back to explicit rendered body html when generated body inputs are empty', () => {
  const value = resolveShopifyBodyHtml({
    'Shopify REST Body HTML': '<p>Rendered body from Shopify field</p>',
    Description: '',
    'Key Features JSON': '',
  });

  assert.equal(value, '<p>Rendered body from Shopify field</p>');
});
