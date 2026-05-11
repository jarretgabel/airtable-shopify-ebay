import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildListingApprovalQueuePanelPropsMock,
  buildListingApprovalSelectedRecordPanelPropsMock,
  buildListingApprovalSelectedRecordStatusPropsMock,
  buildListingApprovalSelectedRecordViewPropsMock,
  getUsedGearWorkflowListingReadinessMock,
} = vi.hoisted(() => ({
  buildListingApprovalQueuePanelPropsMock: vi.fn(() => ({ queue: true })),
  buildListingApprovalSelectedRecordPanelPropsMock: vi.fn((params) => params),
  buildListingApprovalSelectedRecordStatusPropsMock: vi.fn(() => ({ status: true })),
  buildListingApprovalSelectedRecordViewPropsMock: vi.fn(() => ({ view: true })),
  getUsedGearWorkflowListingReadinessMock: vi.fn(() => ({
    title: 'McIntosh MA6900',
    titleFieldName: 'Name',
    description: 'Freshly serviced and ready to publish.',
    descriptionFieldName: 'Description',
    price: '3499.99',
    priceFieldName: 'Price',
    missingRequirements: [],
  })),
}));

vi.mock('@/components/approval/listingApprovalQueuePanelProps', () => ({
  buildListingApprovalQueuePanelProps: buildListingApprovalQueuePanelPropsMock,
}));

vi.mock('@/components/approval/listingApprovalSelectedRecordPanelProps', () => ({
  buildListingApprovalSelectedRecordPanelProps: buildListingApprovalSelectedRecordPanelPropsMock,
}));

vi.mock('@/components/approval/listingApprovalSelectedRecordStatusProps', () => ({
  buildListingApprovalSelectedRecordStatusProps: buildListingApprovalSelectedRecordStatusPropsMock,
}));

vi.mock('@/components/approval/listingApprovalSelectedRecordViewProps', () => ({
  buildListingApprovalSelectedRecordViewProps: buildListingApprovalSelectedRecordViewPropsMock,
}));

vi.mock('@/services/usedGearWorkflowListingReadiness', () => ({
  getUsedGearWorkflowListingReadiness: getUsedGearWorkflowListingReadinessMock,
}));

import { buildListingApprovalTabPanels } from '@/components/approval/listingApprovalTabPanels';
import type { AirtableRecord } from '@/types/airtable';

function createBaseParams(selectedRecord: AirtableRecord | null): Parameters<typeof buildListingApprovalTabPanels>[0] {
  return {
    selectedRecord,
    approvalChannel: 'combined' as const,
    isCombinedApproval: true,
    approvedFieldName: 'Approved',
    allFieldNames: ['Name'],
    formRequiredFieldNames: [],
    formShopifyRequiredFieldNames: [],
    formEbayRequiredFieldNames: [],
    formValues: { Name: 'McIntosh MA6900' },
    fieldKinds: { Name: 'text' as const },
    listingFormatOptions: [],
    listingDurationOptions: [],
    saving: false,
    setFormValue: vi.fn(),
    currentPageShopifyBodyHtml: '',
    currentPageShopifyTagValues: [],
    currentPageShopifyCollectionIds: [],
    currentPageShopifyCollectionLabelsById: {},
    combinedDescriptionFieldName: 'Description',
    combinedSharedFieldNames: [],
    combinedRequiredFieldNames: [],
    shopifyRequiredFieldNames: [],
    ebayRequiredFieldNames: [],
    combinedSharedKeyFeaturesFieldName: '',
    combinedSharedKeyFeaturesSyncFieldNames: [],
    combinedEbayTestingNotesFieldName: '',
    drawerSourceFields: {},
    sharedDrawerRequiredStatus: { hasRequired: false, allFilled: true },
    combinedShopifyOnlyFieldNames: [],
    shopifyDrawerRequiredStatus: { hasRequired: false, allFilled: true },
    selectedEbayTemplateId: 'classic',
    setSelectedEbayTemplateId: vi.fn(),
    combinedShopifyBodyHtmlFieldName: '',
    combinedShopifyBodyHtmlValue: '',
    currentPageProductDescriptionResolution: { sourceFieldName: '', sourceType: '' },
    currentPageProductDescription: '',
    currentPageProductCategoryResolution: { sourceFieldName: '', sourceType: '' },
    currentPageCategoryIdResolution: { sourceFieldName: '', value: '' },
    shopifyCategoryLookupValue: '',
    shopifyCategoryResolution: { status: 'idle' },
    isShopifyPayloadPreviewContext: false,
    shopifyProductSetRequest: null,
    combinedEbayOnlyFieldNames: [],
    ebayDrawerRequiredStatus: { hasRequired: false, allFilled: true },
    combinedEbayGeneratedBodyHtml: '',
    ebayCategoryLabelsById: {},
    setEbayCategoryLabelsById: vi.fn(),
    setBodyHtmlPreview: vi.fn(),
    combinedEbayBodyHtmlFieldName: '',
    combinedEbayBodyHtmlValue: '',
    bodyHtmlPreview: '',
    isEbayPayloadPreviewContext: false,
    ebayDraftPayloadBundle: null,
    titleFieldName: 'Name',
    isApproved: true,
    error: null,
    onBackToList: vi.fn(),
    approving: false,
    pushingTarget: null,
    hasUnsavedChanges: false,
    changedFieldNames: [],
    hasMissingShopifyRequiredFields: false,
    missingShopifyRequiredFieldNames: [],
    missingShopifyRequiredFieldLabels: [],
    hasMissingEbayRequiredFields: false,
    missingEbayRequiredFieldNames: [],
    missingEbayRequiredFieldLabels: [],
    inlineActionNotices: [],
    fadingInlineNoticeIds: [],
    canUpdateApprovedShopifyListing: false,
    hasExistingShopifyRestProductId: false,
    pushShopifyDisabled: false,
    pushEbayDisabled: false,
    pushBothDisabled: false,
    onResetData: vi.fn(),
    onSaveUpdates: vi.fn(),
    onPrimaryAction: vi.fn(),
    runCombinedPush: vi.fn(),
    hasTableReference: true,
    loading: false,
    creatingShopifyListing: false,
    tableReference: 'appApproval/table',
    tableName: 'Approval',
    records: selectedRecord ? [selectedRecord] : [],
    formatFieldName: '',
    priceFieldName: 'Price',
    vendorFieldName: '',
    qtyFieldName: '',
    openRecord: vi.fn(),
    onSelectRecord: vi.fn(),
    createNewShopifyListing: vi.fn(),
    loadRecords: vi.fn(),
  };
}

describe('buildListingApprovalTabPanels', () => {
  beforeEach(() => {
    buildListingApprovalQueuePanelPropsMock.mockClear();
    buildListingApprovalSelectedRecordPanelPropsMock.mockClear();
    buildListingApprovalSelectedRecordStatusPropsMock.mockClear();
    buildListingApprovalSelectedRecordViewPropsMock.mockClear();
    getUsedGearWorkflowListingReadinessMock.mockClear();
  });

  it('threads workflow summary into the selected-record panel for combined approval rows', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-workflow-1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'McIntosh MA6900',
        'Workflow Status': 'Approved for Publish',
        'Pre-Listing Reviewed By': 'Taylor Reviewer',
      },
    };

    const result = buildListingApprovalTabPanels(createBaseParams(selectedRecord));

    expect(getUsedGearWorkflowListingReadinessMock).toHaveBeenCalledWith(selectedRecord);
    expect(buildListingApprovalSelectedRecordPanelPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      eyebrowLabel: 'Combined Listing Editor',
      workflowSummary: expect.objectContaining({
        workflowStatus: 'Approved for Publish',
        workflowNextTeam: 'Listing',
        resolvedPrice: '3499.99',
        preListingReviewedBy: 'Taylor Reviewer',
        timeline: expect.any(Array),
      }),
    }));
    expect(result.selectedRecordPanelProps?.workflowSummary).toMatchObject({
      workflowStatus: 'Approved for Publish',
      workflowNextTeam: 'Listing',
      resolvedPrice: '3499.99',
      preListingReviewedBy: 'Taylor Reviewer',
    });
    expect(result.selectedRecordPanelProps?.workflowSummary?.timeline).toEqual(expect.any(Array));
  });

  it('omits workflow summary when the selected row is not a workflow-backed combined record', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-non-workflow-1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'Sansui AU-919',
      },
    };

    buildListingApprovalTabPanels(createBaseParams(selectedRecord));

    expect(getUsedGearWorkflowListingReadinessMock).not.toHaveBeenCalled();
    expect(buildListingApprovalSelectedRecordPanelPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      eyebrowLabel: 'Combined Listing Editor',
      workflowSummary: null,
    }));
  });

  it('maps channel-specific eyebrow labels into selected-record panel props', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-channel-1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: { Name: 'Luxman L-509Z' },
    };

    buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      approvalChannel: 'shopify',
      isCombinedApproval: false,
    });

    expect(buildListingApprovalSelectedRecordPanelPropsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      eyebrowLabel: 'Shopify Listing Editor',
    }));

    buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      approvalChannel: 'ebay',
      isCombinedApproval: false,
    });

    expect(buildListingApprovalSelectedRecordPanelPropsMock).toHaveBeenLastCalledWith(expect.objectContaining({
      eyebrowLabel: 'eBay Listing Editor',
    }));
  });
});
