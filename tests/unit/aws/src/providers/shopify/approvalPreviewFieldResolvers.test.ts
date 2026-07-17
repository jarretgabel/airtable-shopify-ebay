import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBodyHtml,
  resolveCategoryId,
  resolveProductCategory,
} from '../../../../../../aws/src/providers/shopify/approvalPreviewFieldResolvers.js';

test('resolveBodyHtml prefers rendered Shopify body fields over plain description fields', () => {
  const result = resolveBodyHtml(
    {
      Description: 'Plain text description should not drive HTML payload',
      'Item Description': 'Another plain description',
      'Shopify REST Body HTML': '<p>Rendered Shopify Body</p>',
    },
    {
      title: 'Example Product',
      body_html: '<p>Draft fallback</p>',
    },
  );

  assert.equal(result.sourceFieldName, 'Shopify REST Body HTML');
  assert.equal(result.sourceType, 'exact');
  assert.equal(result.value, '<p>Rendered Shopify Body</p>');
});

test('resolveBodyHtml falls back to draft rendered body when only plain descriptions are present', () => {
  const result = resolveBodyHtml(
    {
      Description: 'Plain text description',
      'Item Description': 'Another plain description',
    },
    {
      title: 'Example Product',
      body_html: '<p>Rendered Shopify Body From Template</p>',
    },
  );

  assert.equal(result.sourceType, 'draft-product');
  assert.equal(result.value, '<p>Rendered Shopify Body From Template</p>');
});

test('resolveProductCategory picks Shopify Type when present', () => {
  const result = resolveProductCategory(
    {
      'Shopify Type': 'Electronics > Audio > Receivers',
    },
    {
      title: 'Example Product',
      product_type: 'Amplifier',
    },
  );

  assert.equal(result.sourceFieldName, 'Shopify Type');
  assert.equal(result.sourceType, 'exact');
  assert.equal(result.value, 'Electronics > Audio > Receivers');
});

test('resolveCategoryId accepts taxonomy gid from Category ID', () => {
  const result = resolveCategoryId({
    'Category ID': 'gid://shopify/TaxonomyCategory/el-2-3-10',
  });

  assert.equal(result.sourceFieldName, 'Category ID');
  assert.equal(result.sourceType, 'exact');
  assert.equal(result.value, 'gid://shopify/TaxonomyCategory/el-2-3-10');
});

test('resolveCategoryId ignores non-gid category text values', () => {
  const result = resolveCategoryId({
    'Category ID': 'Electronics > Audio > Receivers',
    'Shopify Category': 'Receivers',
  });

  assert.equal(result.sourceType, 'none');
  assert.equal(result.value, '');
});
