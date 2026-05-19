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
        Price: '499.99',
        'Product Category': 'Receivers',
      }),
      createRecord('needs-work', {
        'Workflow Status': 'Approved for Publish',
        'Item Title': 'Turntable',
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
});