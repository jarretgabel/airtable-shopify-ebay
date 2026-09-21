import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApprovalFormFieldSetup } from '@/components/approval/useApprovalFormFieldSetup';

vi.mock('@/components/approval/useApprovalFormEbaySetup', () => ({
  useApprovalFormEbaySetup: vi.fn(() => ({
    ebayMarketplaceId: 'EBAY_US',
  })),
}));

vi.mock('@/components/approval/useApprovalFormShopifySetup', () => ({
  useApprovalFormShopifySetup: vi.fn(() => ({
    shopifyBodyDescriptionFieldName: undefined,
  })),
}));

describe('useApprovalFormFieldSetup listing image selection', () => {
  it('keeps an explicit empty workflow selection empty instead of restoring all metadata images', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images',
      approvalChannel: 'combined',
      forceShowShopifyCollectionsEditor: false,
      isCombinedApproval: true,
      allFieldNames: [
        'Images',
        'Images Alt Text',
        'Shopify REST Images JSON',
        'Workflow Image Metadata JSON',
      ],
      writableFieldNames: [
        'Images',
        'Images Alt Text',
        'Shopify REST Images JSON',
      ],
      formValues: {
        Images: '',
        'Images Alt Text': '',
        'Shopify REST Images JSON': '[]',
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            url: 'https://cdn.example.com/testing-1-processed.jpg',
            filename: 'testing-1-processed.jpg',
            sourceStage: 'testing',
            includedInListing: true,
            sortOrder: 1,
          },
        ]),
      },
      fieldKinds: {},
      originalFieldValues: {},
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: 'classic',
      onEbayTemplateIdChange: vi.fn(),
    }));

    expect(result.current.selectedWorkflowImageUrls).toEqual([]);
  });

  it('defaults to non-intake metadata images when no explicit listing image selection exists', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-default',
      approvalChannel: 'combined',
      forceShowShopifyCollectionsEditor: false,
      isCombinedApproval: true,
      allFieldNames: [
        'Images',
        'Images Alt Text',
        'Shopify REST Images JSON',
        'Workflow Image Metadata JSON',
      ],
      writableFieldNames: [
        'Images',
        'Images Alt Text',
        'Shopify REST Images JSON',
      ],
      formValues: {
        Images: '',
        'Images Alt Text': '',
        'Shopify REST Images JSON': '',
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            url: 'https://cdn.example.com/testing-1-processed.jpg',
            filename: 'testing-1-processed.jpg',
            sourceStage: 'testing',
            includedInListing: true,
            sortOrder: 1,
          },
          {
            url: 'https://cdn.example.com/intake-1-processed.jpg',
            filename: 'intake-1-processed.jpg',
            sourceStage: 'intake',
            includedInListing: true,
            sortOrder: 2,
          },
        ]),
      },
      fieldKinds: {},
      originalFieldValues: {},
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: 'classic',
      onEbayTemplateIdChange: vi.fn(),
    }));

    expect(result.current.selectedWorkflowImageUrls).toEqual(['https://cdn.example.com/testing-1-processed.jpg']);
  });
});
