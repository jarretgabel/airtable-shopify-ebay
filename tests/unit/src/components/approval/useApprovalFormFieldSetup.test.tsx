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
        'Workflow Image Metadata JSON',
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

  it('uses workflow metadata inclusion state when metadata exists and no explicit selection input is present', () => {
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
        'Workflow Image Metadata JSON',
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
            url: 'https://cdn.example.com/photos-2-processed.jpg',
            filename: 'photos-2-processed.jpg',
            sourceStage: 'photos',
            includedInListing: false,
            sortOrder: 2,
          },
          {
            url: 'https://cdn.example.com/intake-1-processed.jpg',
            filename: 'intake-1-processed.jpg',
            sourceStage: 'intake',
            includedInListing: true,
            sortOrder: 3,
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

    expect(result.current.selectedWorkflowImageUrls).toEqual([
      'https://cdn.example.com/testing-1-processed.jpg',
    ]);
  });

  it('does not force metadata selection when metadata field is read-only', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-readonly-metadata',
      approvalChannel: 'combined',
      forceShowShopifyCollectionsEditor: false,
      isCombinedApproval: true,
      allFieldNames: ['Images', 'Workflow Image Metadata JSON'],
      writableFieldNames: ['Images'],
      formValues: {
        Images: 'https://cdn.example.com/photos-2-processed.jpg',
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            attachmentId: 'att-testing-1',
            url: 'https://cdn.example.com/testing-1-processed.jpg',
            filename: 'testing-1-processed.jpg',
            alt: '',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: true,
          },
        ]),
      },
      originalFieldValues: {
        Images: JSON.stringify([
          { id: 'att-testing-1', url: 'https://cdn.example.com/testing-1-processed.jpg', filename: 'testing-1-processed.jpg' },
          { id: 'att-photos-2', url: 'https://cdn.example.com/photos-2-processed.jpg', filename: 'photos-2-processed.jpg' },
        ]),
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            attachmentId: 'att-testing-1',
            url: 'https://cdn.example.com/testing-1-processed.jpg',
            filename: 'testing-1-processed.jpg',
            alt: '',
            sortOrder: 1,
            sourceStage: 'testing',
            includedInListing: true,
          },
        ]),
      },
      fieldKinds: {},
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: 'classic',
      onEbayTemplateIdChange: vi.fn(),
    }));

    expect(result.current.selectedWorkflowImageUrls).toEqual([
      'https://cdn.example.com/photos-2-processed.jpg',
    ]);
  });

  it('uses workflow metadata as canonical selected source when metadata exists', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-url-variant',
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
        'Workflow Image Metadata JSON',
      ],
      formValues: {
        Images: JSON.stringify([
          {
            url: 'https://dl.airtableusercontent.com/.attachments/variant/photo-1.jpg',
            filename: 'photo-1-processed.jpg',
          },
        ]),
        'Images Alt Text': '',
        'Shopify REST Images JSON': '',
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            url: 'https://drive.google.com/uc?export=view&id=file-photo-1',
            filename: 'photo-1-processed.jpg',
            sourceStage: 'photos',
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

    expect(result.current.selectedWorkflowImageUrls).toEqual([
      'https://drive.google.com/uc?export=view&id=file-photo-1',
    ]);
  });

  it('prefers edited metadata in form values over original metadata snapshot', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-form-overrides-original',
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
        'Workflow Image Metadata JSON',
      ],
      formValues: {
        Images: '',
        'Images Alt Text': '',
        'Shopify REST Images JSON': '',
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            url: 'https://cdn.example.com/mit-miterminator-4-box-label-detail-processed.jpg',
            filename: 'mit-miterminator-4-box-label-detail-processed.jpg',
            sourceStage: 'photos',
            includedInListing: true,
            sortOrder: 1,
          },
        ]),
      },
      fieldKinds: {},
      originalFieldValues: {
        'Workflow Image Metadata JSON': JSON.stringify([
          {
            url: 'https://cdn.example.com/mit-miterminator-4-box-label-detail-processed.jpg',
            filename: 'mit-miterminator-4-box-label-detail-processed.jpg',
            sourceStage: 'photos',
            includedInListing: false,
            sortOrder: 1,
          },
        ]),
      },
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: 'classic',
      onEbayTemplateIdChange: vi.fn(),
    }));

    expect(result.current.selectedWorkflowImageUrls).toEqual([
      'https://cdn.example.com/mit-miterminator-4-box-label-detail-processed.jpg',
    ]);
  });

  it('ignores original (non-processed) metadata rows when deriving selected listing images', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-processed-only',
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
            url: 'https://cdn.example.com/mit-miterminator-4-badge-detail.jpg',
            filename: 'mit-miterminator-4-badge-detail.jpg',
            sourceStage: 'photos',
            includedInListing: true,
            sortOrder: 1,
          },
          {
            url: 'https://cdn.example.com/mit-miterminator-4-badge-detail-processed.jpg',
            filename: 'mit-miterminator-4-badge-detail-processed.jpg',
            sourceStage: 'photos',
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

    expect(result.current.selectedWorkflowImageUrls).toEqual([
      'https://cdn.example.com/mit-miterminator-4-badge-detail-processed.jpg',
    ]);
  });

  it('exposes only processed attachments to listing selector when metadata is absent', () => {
    const { result } = renderHook(() => useApprovalFormFieldSetup({
      recordId: 'rec-listing-images-attachments-only',
      approvalChannel: 'combined',
      forceShowShopifyCollectionsEditor: false,
      isCombinedApproval: true,
      allFieldNames: ['Images', 'Images Alt Text', 'Shopify REST Images JSON'],
      writableFieldNames: ['Images', 'Images Alt Text', 'Shopify REST Images JSON'],
      formValues: {
        Images: JSON.stringify([
          {
            url: 'https://cdn.example.com/mit-miterminator-4-badge-detail.jpg',
            filename: 'mit-miterminator-4-badge-detail.jpg',
          },
          {
            url: 'https://cdn.example.com/mit-miterminator-4-badge-detail-processed.jpg',
            filename: 'mit-miterminator-4-badge-detail-processed.jpg',
          },
        ]),
        'Images Alt Text': '',
        'Shopify REST Images JSON': '',
      },
      fieldKinds: {},
      originalFieldValues: {},
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: 'classic',
      onEbayTemplateIdChange: vi.fn(),
    }));

    expect(result.current.workflowImageAttachments).toEqual([
      {
        url: 'https://cdn.example.com/mit-miterminator-4-badge-detail-processed.jpg',
        filename: 'mit-miterminator-4-badge-detail-processed.jpg',
      },
    ]);
  });
});
