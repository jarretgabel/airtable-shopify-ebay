import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterCombinedNeedsFurtherWorkRecords,
  filterCombinedReadyForPublishingRecords,
  getCombinedListingsRequiredFieldNames,
} from './combinedListingsReadiness.js';

const complete = {
  'Workflow Status': 'Awaiting Pre-Listing Review',
  SKU: { text: '11751' },
  Title: 'Proceed HPA 2',
  Price: '1200',
  Quantity: '1',
  'Shopify Type': 'Amplifier',
  'Ebay Listing Format': 'FixedPrice',
};

test('splits listing rows into ready and needs-work sets', () => {
  const records = [
    { id: 'ready', fields: complete },
    { id: 'missing-price', fields: { ...complete, Price: '' } },
    { id: 'listed', fields: { ...complete, 'Workflow Status': 'Listed, Shopify' } },
    { id: 'other-status', fields: { ...complete, 'Workflow Status': 'Testing In Progress' } },
  ];
  const names = getCombinedListingsRequiredFieldNames(records);

  assert.deepEqual(filterCombinedReadyForPublishingRecords(records, names).map((r) => r.id), ['ready']);
  assert.deepEqual(filterCombinedNeedsFurtherWorkRecords(records, names).map((r) => r.id), ['missing-price']);
});
