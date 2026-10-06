import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEbayApprovalPreviewFromFields } from '../../../../../../aws/src/providers/ebay/approvalPreview.js';

test('generated eBay body HTML is mapped to listingDescription without a canonical Airtable field', () => {
  const preview = buildEbayApprovalPreviewFromFields({
    'eBay Inventory SKU': 'PREVIEW-SKU',
    'Item Title': 'MIT MITerminator 2',
  }, {
    templateHtml: '<html><body><h1>{{title}}</h1><p>{{description}}</p></body></html>',
    title: 'MIT MITerminator 2',
    description: 'Speaker cables',
    keyFeatures: '',
    fieldName: undefined,
  });

  assert.equal(
    preview.draftPayloadBundle.offer.listingDescription,
    '<html><body><h1>MIT MITerminator 2</h1><p>Speaker cables</p></body></html>',
  );
});

test('generated eBay body HTML overrides stale duplicate body field aliases', () => {
  const preview = buildEbayApprovalPreviewFromFields({
    'eBay Inventory SKU': 'PREVIEW-SKU',
    'Item Title': 'MIT MITerminator 2',
    'Ebay Body (HTML)': '<p>Stale body</p>',
    'eBay Body HTML': '<p>Previously generated body</p>',
  }, {
    templateHtml: '<html><body><h1>{{title}}</h1><p>{{description}}</p></body></html>',
    title: 'MIT MITerminator 2',
    description: 'Fresh speaker cable description',
    keyFeatures: '',
    fieldName: 'eBay Body HTML',
  });

  assert.equal(
    preview.draftPayloadBundle.offer.listingDescription,
    '<html><body><h1>MIT MITerminator 2</h1><p>Fresh speaker cable description</p></body></html>',
  );
});