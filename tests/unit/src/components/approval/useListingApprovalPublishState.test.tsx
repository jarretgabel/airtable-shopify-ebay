import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalPublishState } from '@/components/approval/useListingApprovalPublishState';
import type { AirtableRecord } from '@/types/airtable';

const record: AirtableRecord = {
  id: 'rec_listing_1',
  createdTime: '2025-01-01T00:00:00.000Z',
  fields: {
    Title: '',
    Description: '',
    Approved: false,
    'Workflow Status': 'Approved for Publish',
    Make: 'McIntosh',
    Model: 'MA6900',
    'Inventory Notes': 'Fresh service completed and ready for listing.',
  },
};

describe('useListingApprovalPublishState', () => {
  it('does not mark workflow-prefilled baseline values as unsaved changes', () => {
    const { result } = renderHook(() => useListingApprovalPublishState({
      allFieldNames: ['Title', 'Description', 'Approved'],
      approvalChannel: 'combined',
      formValues: {
        Title: 'McIntosh MA6900',
        Description: 'Fresh service completed and ready for listing.',
        Approved: 'false',
      },
      initialFormValues: {
        Title: 'McIntosh MA6900',
        Description: 'Fresh service completed and ready for listing.',
        Approved: 'false',
      },
      mergedDraftSourceFields: record.fields,
      selectedRecord: record,
      combinedSharedFieldNames: ['Title', 'Description'],
      combinedShopifyOnlyFieldNames: [],
      combinedEbayOnlyFieldNames: [],
      tableReference: 'tbl_test',
    }));

    expect(result.current.changedFieldNames).toEqual([]);
    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('marks a field dirty after it diverges from the hydrated baseline', () => {
    const { result } = renderHook(() => useListingApprovalPublishState({
      allFieldNames: ['Title', 'Description', 'Approved'],
      approvalChannel: 'combined',
      formValues: {
        Title: 'McIntosh MA6900 Rev 2',
        Description: 'Fresh service completed and ready for listing.',
        Approved: 'false',
      },
      initialFormValues: {
        Title: 'McIntosh MA6900',
        Description: 'Fresh service completed and ready for listing.',
        Approved: 'false',
      },
      mergedDraftSourceFields: record.fields,
      selectedRecord: record,
      combinedSharedFieldNames: ['Title', 'Description'],
      combinedShopifyOnlyFieldNames: [],
      combinedEbayOnlyFieldNames: [],
      tableReference: 'tbl_test',
    }));

    expect(result.current.changedFieldNames).toEqual(['Title']);
    expect(result.current.hasUnsavedChanges).toBe(true);
  });
});