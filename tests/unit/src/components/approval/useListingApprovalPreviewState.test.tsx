import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useListingApprovalPreviewState } from '@/components/approval/useListingApprovalPreviewState';

const useApprovalPreviewMock = vi.fn();

vi.mock('@/hooks/approval/useApprovalPreview', () => ({
  useApprovalPreview: (...args: unknown[]) => useApprovalPreviewMock(...args),
}));

describe('useListingApprovalPreviewState', () => {
  beforeEach(() => {
    useApprovalPreviewMock.mockReset();
    useApprovalPreviewMock.mockReturnValue({
      ebayApprovalPreview: {
        generatedBodyHtml: '',
        draftPayloadBundle: { inventoryItem: {}, offer: {} },
        categoryFieldUpdates: {},
      },
      isEbayPayloadPreviewContext: true,
      isShopifyPayloadPreviewContext: false,
      loadShopifyApprovalPreviewNow: vi.fn(),
      mergedDraftSourceFields: null,
      shopifyApprovalPreview: null,
    });
  });

  it('falls back to locally generated eBay body html when the preview response omits generated html', async () => {
    const setDerivedFormValue = vi.fn();

    const { result } = renderHook(() => useListingApprovalPreviewState({
      approvalChannel: 'combined',
      isCombinedApproval: true,
      selectedRecord: {
        id: 'rec-preview-state-1',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: {
          Title: 'Marantz 2270',
          Description: 'Receiver description',
          Make: 'Marantz',
          Model: '2270',
          'Key Features': 'Component Type,Stereo Receiver\nIncludes,Original wood case',
          'Testing Notes': 'Bench tested',
        },
      },
      fieldKinds: {},
      formValues: {
        Title: 'Marantz 2270',
        Description: 'Receiver description',
        Make: '',
        Model: '',
        'Key Features': 'Component Type,Stereo Receiver\nIncludes,Original wood case',
        'Testing Notes': 'Bench tested',
        'eBay Body HTML': '',
      },
      setDerivedFormValue,
      ebayCategoryLabelsById: {},
      selectedEbayTemplateId: 'classic',
      combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
    }));

    await waitFor(() => {
      expect(result.current.combinedEbayGeneratedBodyHtml).toContain('Marantz');
    });

    expect(result.current.combinedEbayGeneratedBodyHtml).toContain('2270');
    expect(setDerivedFormValue).toHaveBeenCalledWith(
      'eBay Body HTML',
      expect.stringContaining('Marantz'),
    );
  });

  it('builds local combined eBay body html from merged source fields when the selected record is stale', async () => {
    const setDerivedFormValue = vi.fn();

    useApprovalPreviewMock.mockReturnValueOnce({
      ebayApprovalPreview: {
        generatedBodyHtml: '',
        draftPayloadBundle: { inventoryItem: {}, offer: {} },
        categoryFieldUpdates: {},
      },
      isEbayPayloadPreviewContext: true,
      isShopifyPayloadPreviewContext: false,
      loadShopifyApprovalPreviewNow: vi.fn(),
      mergedDraftSourceFields: {
        Title: 'Marantz 2270',
        Description: 'Receiver description',
        Make: 'Marantz',
        Model: '2270',
        'Key Features': 'Component Type,Stereo Receiver\nIncludes,Original wood case',
        'Testing Notes': 'Bench tested',
      },
      shopifyApprovalPreview: null,
    });

    const { result } = renderHook(() => useListingApprovalPreviewState({
      approvalChannel: 'combined',
      isCombinedApproval: true,
      selectedRecord: {
        id: 'rec-preview-state-stale',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: {
          Title: 'Marantz 2270',
        },
      },
      fieldKinds: {},
      formValues: {
        'eBay Body HTML': '',
      },
      setDerivedFormValue,
      ebayCategoryLabelsById: {},
      selectedEbayTemplateId: 'classic',
      combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
    }));

    await waitFor(() => {
      expect(result.current.combinedEbayGeneratedBodyHtml).toContain('Marantz');
    });

    expect(result.current.combinedEbayGeneratedBodyHtml).toContain('2270');
    expect(result.current.combinedEbayGeneratedBodyHtml).toContain('Stereo Receiver');
  });

  it('prefers the local combined eBay body html over stale API preview html', async () => {
    const setDerivedFormValue = vi.fn();

    useApprovalPreviewMock.mockReturnValueOnce({
      ebayApprovalPreview: {
        generatedBodyHtml: '<h2>Key Features</h2><table><tbody><tr><th>Cosmetic Notes</th><td>Only two rows</td></tr></tbody></table>',
        draftPayloadBundle: { inventoryItem: {}, offer: {} },
        categoryFieldUpdates: {},
      },
      isEbayPayloadPreviewContext: true,
      isShopifyPayloadPreviewContext: false,
      loadShopifyApprovalPreviewNow: vi.fn(),
      mergedDraftSourceFields: {
        Title: 'Marantz 2270',
        Description: 'Receiver description',
        Make: 'Marantz',
        Model: '2270',
        'Key Features': 'Component Type,Stereo Receiver\nIncludes,Original wood case',
        'Testing Notes': 'Bench tested',
      },
      shopifyApprovalPreview: null,
    });

    const { result } = renderHook(() => useListingApprovalPreviewState({
      approvalChannel: 'combined',
      isCombinedApproval: true,
      selectedRecord: {
        id: 'rec-preview-state-api-stale',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: {
          Title: 'Marantz 2270',
        },
      },
      fieldKinds: {},
      formValues: {
        'eBay Body HTML': '',
      },
      setDerivedFormValue,
      ebayCategoryLabelsById: {},
      selectedEbayTemplateId: 'classic',
      combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
    }));

    await waitFor(() => {
      expect(result.current.combinedEbayGeneratedBodyHtml).toContain('Marantz');
    });

    expect(result.current.combinedEbayGeneratedBodyHtml).toContain('2270');
    expect(result.current.combinedEbayGeneratedBodyHtml).not.toContain('Only two rows');
  });

  it('prefers the local combined Shopify body html over stale preview body html', async () => {
    useApprovalPreviewMock.mockReturnValueOnce({
      ebayApprovalPreview: {
        generatedBodyHtml: '',
        draftPayloadBundle: { inventoryItem: {}, offer: {} },
        categoryFieldUpdates: {},
      },
      isEbayPayloadPreviewContext: true,
      isShopifyPayloadPreviewContext: true,
      loadShopifyApprovalPreviewNow: vi.fn(),
      mergedDraftSourceFields: {
        Description: 'Freshly serviced receiver.',
        'Key Features': 'Condition,Excellent\nIncludes,Original box',
        'Shopify Body HTML': '<p>Saved stale Shopify html</p>',
      },
      shopifyApprovalPreview: {
        bodyHtmlResolution: {
          sourceFieldName: 'Shopify Body HTML',
          sourceType: 'exact',
          value: '<p>Saved stale Shopify html</p>',
        },
        productDescriptionResolution: {
          sourceFieldName: 'Description',
          sourceType: 'exact',
          value: 'Freshly serviced receiver.',
        },
        tagValues: [],
        collectionIds: [],
        collectionLabelsById: {},
        productCategoryResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
        categoryIdResolution: { sourceFieldName: '', sourceType: 'none', value: '' },
        categoryLookupValue: '',
        categoryResolution: { status: 'idle', match: null, error: '' },
        resolvedCategoryId: undefined,
        productSetRequest: null,
        draftProduct: { title: '', body_html: '<p>Saved stale Shopify html</p>' },
        effectiveProduct: { title: '', body_html: '<p>Saved stale Shopify html</p>' },
      },
    });

    const { result } = renderHook(() => useListingApprovalPreviewState({
      approvalChannel: 'combined',
      isCombinedApproval: true,
      selectedRecord: {
        id: 'rec-preview-state-shopify-stale',
        createdTime: '2026-05-18T00:00:00.000Z',
        fields: {
          Description: 'Freshly serviced receiver.',
          'Key Features': 'Condition,Excellent\nIncludes,Original box',
          'Shopify Body HTML': '<p>Saved stale Shopify html</p>',
        },
      },
      fieldKinds: {},
      formValues: {
        Description: 'Freshly serviced receiver.',
        'Key Features': 'Condition,Excellent\nIncludes,Original box',
        'Shopify Body HTML': '<p>Saved stale Shopify html</p>',
      },
      setDerivedFormValue: vi.fn(),
      ebayCategoryLabelsById: {},
      selectedEbayTemplateId: 'classic',
      combinedEbayBodyHtmlFieldName: 'eBay Body HTML',
      combinedEbayTestingNotesFieldName: 'Testing Notes',
      combinedEbayTitleFieldName: 'Title',
      combinedDescriptionFieldName: 'Description',
      combinedMakeFieldName: 'Make',
      combinedModelFieldName: 'Model',
      combinedSharedKeyFeaturesFieldName: 'Key Features',
    }));

    await waitFor(() => {
      expect(result.current.currentPageShopifyBodyHtml).toContain('Freshly serviced receiver.');
    });

    expect(result.current.currentPageShopifyBodyHtml).toContain('Includes');
    expect(result.current.currentPageShopifyBodyHtml).toContain('Condition');
    expect(result.current.currentPageShopifyBodyHtml).not.toContain('Saved stale Shopify html');
  });
});