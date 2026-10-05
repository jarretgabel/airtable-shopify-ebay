import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShopifyTaxonomyChoiceMetafields,
  parseShopifyTaxonomyAttributes,
  resolveTaxonomyAttributeSearch,
} from '../../../../../../aws/src/providers/shopify/taxonomyAttributes.ts';
import { buildShopifyUnifiedProductSetRequest } from '../../../../../../aws/src/providers/shopify/approvalDraftUnified.ts';

const categoryId = 'gid://shopify/TaxonomyCategory/el-2-2-2';
const attributeId = 'gid://shopify/TaxonomyAttribute/1';
const valueId = 'gid://shopify/TaxonomyValue/1';
const metaobjectId = 'gid://shopify/Metaobject/81382474050';

test('taxonomy choice selections produce native Shopify metafields', () => {
  const document = parseShopifyTaxonomyAttributes(JSON.stringify({
    version: 1,
    categoryId,
    categoryFullName: 'Electronics > Audio > Audio Amplifiers',
    attributes: [{ id: attributeId, name: 'Color', type: 'choice', values: [{ id: valueId, name: 'Black', metaobjectId }] }],
  }));

  const metafields = buildShopifyTaxonomyChoiceMetafields(document, [{
    id: attributeId,
    name: 'Color',
    type: 'choice',
    values: [{ id: valueId, name: 'Black' }],
  }]);

  assert.deepEqual(metafields, [{
    namespace: 'shopify',
    key: 'color-pattern',
    type: 'list.metaobject_reference',
    value: JSON.stringify([metaobjectId]),
  }]);
});

test('taxonomy attribute lookup prefers the saved category name when GID resolution echoes the ID', () => {
  const document = parseShopifyTaxonomyAttributes(JSON.stringify({
    version: 1,
    categoryId,
    categoryFullName: 'Electronics > Audio > Audio Components > Audio Amplifiers',
    attributes: [],
  }));

  assert.ok(document);
  assert.equal(
    resolveTaxonomyAttributeSearch(document, categoryId),
    'Electronics > Audio > Audio Components > Audio Amplifiers',
  );
});

test('stale taxonomy values are omitted from the native payload', () => {
  const document = parseShopifyTaxonomyAttributes(JSON.stringify({
    version: 1,
    categoryId,
    categoryFullName: 'Electronics > Audio > Audio Amplifiers',
    attributes: [{
      id: attributeId,
      name: 'Color',
      type: 'choice',
      values: [{ id: 'gid://shopify/TaxonomyValue/stale', name: 'Stale' }],
    }],
  }));

  assert.deepEqual(buildShopifyTaxonomyChoiceMetafields(document, [{
    id: attributeId,
    name: 'Color',
    type: 'choice',
    values: [{ id: valueId, name: 'Black' }],
  }]), []);
});

test('taxonomy values without resolved metaobject references are omitted', () => {
  const document = parseShopifyTaxonomyAttributes(JSON.stringify({
    version: 1,
    categoryId,
    categoryFullName: 'Electronics > Audio > Audio Amplifiers',
    attributes: [{ id: attributeId, name: 'Color', type: 'choice', values: [{ id: valueId, name: 'Black' }] }],
  }));

  assert.deepEqual(buildShopifyTaxonomyChoiceMetafields(document, [{
    id: attributeId,
    name: 'Color',
    type: 'choice',
    values: [{ id: valueId, name: 'Black' }],
  }]), []);
});

test('taxonomy values use separately resolved metaobject references', () => {
  const document = parseShopifyTaxonomyAttributes(JSON.stringify({
    version: 1,
    categoryId,
    categoryFullName: 'Electronics > Audio > Audio Amplifiers',
    attributes: [{ id: attributeId, name: 'Color', type: 'choice', values: [{ id: valueId, name: 'Black' }] }],
  }));

  assert.deepEqual(buildShopifyTaxonomyChoiceMetafields(document, [{
    id: attributeId,
    name: 'Color',
    type: 'choice',
    values: [{ id: valueId, name: 'Black' }],
  }], { [valueId]: metaobjectId }), [{
    namespace: 'shopify',
    key: 'color-pattern',
    type: 'list.metaobject_reference',
    value: JSON.stringify([metaobjectId]),
  }]);
});

test('ProductSet requests merge taxonomy metafields with existing metafields', () => {
  const request = buildShopifyUnifiedProductSetRequest({
    title: 'Amplifier',
    body_html: '<p>Test</p>',
    variants: [],
    metafields: [{ namespace: 'custom', key: 'condition', type: 'single_line_text_field', value: 'Used' }],
  }, {
    categoryId,
    taxonomyMetafields: [{ namespace: 'shopify', key: 'color-pattern', type: 'list.metaobject_reference', value: JSON.stringify([valueId]) }],
  });

  assert.deepEqual(request.input.metafields, [
    { namespace: 'custom', key: 'condition', type: 'single_line_text_field', value: 'Used' },
    { namespace: 'shopify', key: 'color-pattern', type: 'list.metaobject_reference', value: JSON.stringify([valueId]) },
  ]);
});