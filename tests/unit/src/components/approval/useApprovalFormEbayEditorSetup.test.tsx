import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApprovalFormEbayEditorSetup } from '@/components/approval/useApprovalFormEbayEditorSetup';

vi.mock('@/services/app-api/ebay', () => ({
  getEbayPackageTypes: vi.fn(async () => []),
}));

describe('useApprovalFormEbayEditorSetup', () => {
  it('keeps eBay aspects fields hidden without exposing an attributes editor', () => {
    const setFormValue = vi.fn();

    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-approval',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: [
        'Title',
        'eBay Inventory Product Aspects JSON',
        'eBay Inventory Product Aspects',
      ],
      writableFieldNames: [
        'Title',
        'eBay Inventory Product Aspects JSON',
        'eBay Inventory Product Aspects',
      ],
      formValues: {
        Title: 'McIntosh MC2105',
        'eBay Inventory Product Aspects JSON': JSON.stringify([{ name: 'Brand', values: ['McIntosh'] }]),
      },
      originalFieldValues: {},
      setFormValue,
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.ebayAttributesCandidateFieldNames).toEqual([
      'eBay Inventory Product Aspects JSON',
      'eBay Inventory Product Aspects',
    ]);
    expect(result.current.ebayAttributesFieldName).toBeUndefined();
    expect(result.current.ebayAttributesSyncFieldNames).toEqual([]);
  });
});
