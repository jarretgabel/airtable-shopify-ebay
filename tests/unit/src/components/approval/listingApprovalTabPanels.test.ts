import { isValidElement } from 'react';
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
    setDerivedFormValue: vi.fn(),
    currentPageShopifyBodyHtml: '',
    currentPageShopifyTagValues: [],
    currentPageShopifyCollectionIds: [],
    currentPageShopifyCollectionLabelsById: {},
    onOpenOperationalRecord: vi.fn(),
    onOpenTestingForm: vi.fn(),
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
    hasExistingEbayOfferId: false,
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
    shopifyAdminListingUrl: null,
    shopifyServiceListingUrl: null,
    ebayAdminListingUrl: null,
    ebayServiceListingUrl: null,
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
    expect(buildListingApprovalSelectedRecordViewPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      onOpenOperationalRecord: expect.any(Function),
      onOpenTestingForm: expect.any(Function),
    }));
    expect(buildListingApprovalSelectedRecordPanelPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      eyebrowLabel: 'Combined Listing Editor',
      workflowDetails: expect.anything(),
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
    expect(result.selectedRecordPanelProps?.workflowDetails).not.toBeNull();
    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      workflowStatus: 'Approved for Publish',
      workflowReadinessMissingRequirements: [],
    }));
  });

  it('threads derived post-publish fields into the lifecycle panel immediately', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-workflow-1',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'McIntosh MA6900',
        'Workflow Status': 'Awaiting Pre-Listing Review',
      },
    };

    const result = buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      formValues: {
        Name: 'McIntosh MA6900',
        'Workflow Status': 'Listed, Shopify',
        'Listed At': '2026-05-07T12:00:00.000Z',
        'Shopify REST Product ID': '12345',
        'eBay Offer ID': 'offer-live',
        'eBay Listing ID': 'listing-live',
      },
    });

    const workflowDetails = result.selectedRecordPanelProps?.workflowDetails;
    expect(isValidElement(workflowDetails)).toBe(true);
    if (!isValidElement<{ selectedRecord: AirtableRecord }>(workflowDetails)) {
      throw new Error('Expected workflow lifecycle panel element.');
    }

    expect(workflowDetails.props.selectedRecord.fields).toMatchObject({
      'Workflow Status': 'Listed, Shopify',
      'Listed At': '2026-05-07T12:00:00.000Z',
      'Shopify REST Product ID': '12345',
    });
    expect(result.selectedRecordPanelProps?.workflowSummary?.workflowStatus).toBe('Listed, Shopify');
    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      workflowStatus: 'Listed, Shopify',
      ebayAdminListingUrl: 'https://www.ebay.com/sh/lst/active',
      ebayServiceListingUrl: 'https://www.ebay.com/itm/listing-live',
    }));
  });

  it('hides stale marketplace links immediately after returning to Ready', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-taken-down',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        'Workflow Status': 'Listed, eBay',
        'eBay Offer ID': 'offer-old',
        'eBay Listing ID': 'listing-old',
      },
    };
    const result = buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      formValues: {
        'Workflow Status': 'Approved for Publish',
        'Listed At': '',
        'eBay Offer ID': '',
        'eBay Listing ID': '',
      },
    });
    expect(result.selectedRecordPanelProps?.workflowSummary?.workflowStatus).toBe('Approved for Publish');
    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      workflowStatus: 'Approved for Publish',
      ebayAdminListingUrl: null,
      ebayServiceListingUrl: null,
    }));
  });

  it('clears the cached listing date when a takedown returns the record to Ready', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-takedown-date',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: { 'Workflow Status': 'Listed, Shopify', 'Listed At': '2026-05-07T12:00:00.000Z' },
    };
    const params = createBaseParams(selectedRecord);
    const result = buildListingApprovalTabPanels(params);
    const details = result.selectedRecordPanelProps?.workflowDetails;
    if (!isValidElement<{ onMovedBackToReady: () => void }>(details)) {
      throw new Error('Expected workflow lifecycle panel.');
    }
    details.props.onMovedBackToReady();
    expect(params.setDerivedFormValue).toHaveBeenCalledWith('Listed At', '');
  });

  it('opens unfiltered Seller Hub and the current listing after republishing', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-republished',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'Bel Canto Pre 1',
        'Workflow Status': 'Listed, eBay',
        'eBay Offer ID': '310041424011',
        'eBay Listing ID': '820235128624',
      },
    };

    buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      formValues: {
        Name: 'Bel Canto Pre 1',
        'eBay Offer ID': '310041424011',
        'eBay Listing ID': '820235156666',
      },
    });

    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      ebayAdminListingUrl: 'https://www.ebay.com/sh/lst/active',
      ebayServiceListingUrl: 'https://www.ebay.com/itm/820235156666',
    }));
  });

  it('keeps marketplace links hidden before publishing even when old eBay IDs remain', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-ready',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'Bel Canto Pre 1',
        'Workflow Status': 'Approved for Publish',
      },
    };

    buildListingApprovalTabPanels({
      ...createBaseParams(selectedRecord),
      formValues: {
        'eBay Offer ID': '310041424011',
        'eBay Listing ID': '820235128624',
      },
    });

    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      ebayAdminListingUrl: null,
      ebayServiceListingUrl: null,
    }));
  });

  it('omits eBay links when marketplace IDs are missing', () => {
    const selectedRecord: AirtableRecord = {
      id: 'rec-no-ebay',
      createdTime: '2026-05-07T00:00:00.000Z',
      fields: {
        Name: 'Bel Canto Pre 1',
        'Workflow Status': 'Listed, Shopify',
      },
    };

    buildListingApprovalTabPanels(createBaseParams(selectedRecord));

    expect(buildListingApprovalSelectedRecordStatusPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      ebayAdminListingUrl: null,
      ebayServiceListingUrl: null,
    }));
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
      workflowDetails: null,
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
