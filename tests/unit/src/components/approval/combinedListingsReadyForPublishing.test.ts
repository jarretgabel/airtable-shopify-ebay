import { describe, expect, it } from 'vitest';
import {
  filterCombinedActiveListingRecords,
  filterCombinedNeedsFurtherWorkRecords,
  filterCombinedReadyForPublishingRecords,
  getCombinedListingsRequiredFieldNames,
  getCombinedReadyForPublishingCount,
} from '@/components/approval/combinedListingsReadyForPublishing';
import type { AirtableRecord } from '@/types/airtable';

function createRecord(id: string, fields: Record<string, unknown>): AirtableRecord {
  return {
    id,
    createdTime: '2024-01-01T00:00:00.000Z',
    fields,
  };
}

describe('combinedListingsReadyForPublishing', () => {
  it('matches the listings page ready, active, and needs-work splits', () => {
    const records: AirtableRecord[] = [
      createRecord('ready', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'Stereo Receiver',
        SKU: 'READY-001',
        Price: '499.99',
        'Product Category': 'Receivers',
      }),
      createRecord('needs-work', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'Turntable',
        SKU: 'NEEDS-001',
        Price: '399.99',
      }),
      createRecord('active', {
        'Workflow Status': 'Listed, Shopify',
        'Item Title': 'Amplifier',
        Price: '299.99',
        'Product Category': 'Amplifiers',
      }),
      createRecord('hidden', {
        'Workflow Status': 'Draft',
        'Item Title': 'Hidden Draft',
        Price: '199.99',
        'Product Category': 'Drafts',
      }),
    ];

    const requiredFieldNames = getCombinedListingsRequiredFieldNames(records);

    expect(filterCombinedReadyForPublishingRecords(records, requiredFieldNames).map((record) => record.id)).toEqual(['ready']);
    expect(filterCombinedActiveListingRecords(records).map((record) => record.id)).toEqual(['active']);
    expect(filterCombinedNeedsFurtherWorkRecords(records, requiredFieldNames).map((record) => record.id)).toEqual(['needs-work']);
    expect(getCombinedReadyForPublishingCount(records)).toBe(1);
  });

  it('keeps awaiting pre-listing review rows out of needs-work until a SKU is assigned', () => {
    const records: AirtableRecord[] = [
      createRecord('awaiting-no-sku', {
        'Workflow Status': 'Awaiting Pre-Listing Review',
        'Item Title': 'Receiver Missing SKU',
        Price: '249.99',
      }),
      createRecord('awaiting-with-sku', {
        'Workflow Status': 'Awaiting Pre-Listing Review',
        'Item Title': 'Receiver With SKU',
        SKU: 'SKU-1234',
        Price: '249.99',
      }),
    ];

    const requiredFieldNames = getCombinedListingsRequiredFieldNames(records);

    expect(filterCombinedNeedsFurtherWorkRecords(records, requiredFieldNames).map((record) => record.id)).toEqual(['awaiting-with-sku']);
  });

  it('requires a SKU for approved rows to appear in needs-further-work', () => {
    const records: AirtableRecord[] = [
      createRecord('approved-no-sku', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'Needs copy edits',
        Price: '799.99',
        'Product Category': 'Receivers',
      }),
      createRecord('approved-with-sku', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'Needs missing vendor',
        SKU: 'WORK-1001',
        Price: '899.99',
      }),
    ];

    const requiredFieldNames = getCombinedListingsRequiredFieldNames(records);

    expect(filterCombinedNeedsFurtherWorkRecords(records, requiredFieldNames).map((record) => record.id)).toEqual(['approved-with-sku']);
  });

  it('requires a SKU for approved rows to appear in ready-for-publishing', () => {
    const records: AirtableRecord[] = [
      createRecord('approved-no-sku', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'No SKU Yet',
        Price: '799.99',
        'Product Category': 'Receivers',
      }),
      createRecord('approved-with-sku', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'With SKU',
        SKU: 'SKU-READY-1',
        Price: '899.99',
        'Product Category': 'Amplifiers',
      }),
    ];

    const requiredFieldNames = getCombinedListingsRequiredFieldNames(records);

    expect(filterCombinedReadyForPublishingRecords(records, requiredFieldNames).map((record) => record.id)).toEqual(['approved-with-sku']);
  });
});