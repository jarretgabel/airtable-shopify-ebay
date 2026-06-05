import { describe, expect, it, vi } from 'vitest';
import { buildDashboardTabViewModel, buildEbayTabViewModel, buildShopifyTabViewModel } from '@/app/appTabContentMappers';
import type { AppTabContentProps } from '@/app/appTabContentTypes';

function buildInput(overrides: Partial<AppTabContentProps> = {}): AppTabContentProps {
  return {
    activeTab: 'dashboard',
    manualIntakeMode: false,
    jotformReviewGroupId: null,
    jotformReviewRecordId: null,
    jotformDirectoryRecordId: null,
    parkingLotArrivalGroupId: null,
    parkingLotArrivalRecordId: null,
    trashReviewGroupId: null,
    trashReviewRecordId: null,
    manualIntakeRecordId: null,
    testingRecordId: null,
    photosRecordId: null,
    inventoryRecordId: null,
    inventoryPriceEditorRecordId: null,
    listingsRecordId: null,
    shopifyListingsRecordId: null,
    ebayListingsRecordId: null,
    soldReadyListingsRecordId: null,
    shippedListingsRecordId: null,
    userRecordId: null,
    navigateToInventoryRecord: vi.fn(),
    navigateToInventoryPriceEditor: vi.fn(),
    navigateToUsedGearOperationalRecord: vi.fn(),
    navigateToInventoryList: vi.fn(),
    navigateToInventoryWorkflowView: vi.fn(),
    navigateToInventoryPostPublishBucket: vi.fn(),
    navigateToPath: vi.fn(),
    navigateToManualIntake: vi.fn(),
    navigateToCreateIntakeItem: vi.fn(),
    navigateToManualIntakeForm: vi.fn(),
    navigateToTestingForm: vi.fn(),
    navigateToPhotosForm: vi.fn(),
    navigateToListingsRecord: vi.fn(),
    navigateToListingsList: vi.fn(),
    navigateToShopifyRecord: vi.fn(),
    navigateToShopifyList: vi.fn(),
    navigateToEbayRecord: vi.fn(),
    navigateToEbayList: vi.fn(),
    navigateToSoldReadyListingRecord: vi.fn(),
    navigateToShippedListingRecord: vi.fn(),
    navigateToUserRecord: vi.fn(),
    navigateToUsersList: vi.fn(),
    navigateToTab: vi.fn(),
    navigateToParkingLotPendingReviewGroup: vi.fn(),
    runtimeFeatures: {
      jotform: { available: true, message: null, missingEnvNames: [] },
      ebay: { available: true, message: null, missingEnvNames: [] },
      approvalEbay: { available: true, message: null, missingEnvNames: [] },
      approvalShopify: { available: true, message: null, missingEnvNames: [] },
      approvalCombined: { available: true, message: null, missingEnvNames: [] },
    },
    metrics: {
      now: Date.now(),
      thisWeekSubs: [],
      recentSubs: [],
      draftProducts: [],
      activeProducts: [],
      archivedProducts: [],
      acquisitionCost: 0,
      inventoryValue: 0,
      avgAskPrice: 0,
      sellThroughPct: null,
      grossMarginPct: null,
      submissionsTrend: { direction: 'flat', text: 'Flat' },
      dealsTrend: { direction: 'flat', text: 'Flat' },
      acquisitionTrend: { direction: 'flat', text: 'Flat' },
      inventoryTrend: { direction: 'flat', text: 'Flat' },
      salesTrend: { direction: 'flat', text: 'Flat' },
      marginTrend: { direction: 'flat', text: 'Flat' },
      submissionDays: [],
      maxDayCount: 0,
      topBrands: [],
      airtableInventoryValue: 0,
      uniqueAirtableBrands: 0,
      uniqueAirtableTypes: 0,
      componentTypeSummary: [],
      airtableBrandSummary: [],
      airtableDistributorSummary: [],
      airtableTypeTable: [],
      maxComponentTypeCount: 0,
      maxAirtableBrandCount: 0,
      insights: [],
    },
    accessiblePages: ['dashboard', 'inventory'],
    currentUserRole: 'admin',
    currentUserName: 'Taylor Reviewer',
    aiProvider: 'none',
    usersCount: 0,
    adminCount: 0,
    nonEmptyListings: [],
    displayValue: (value) => String(value ?? ''),
    hasValue: (value) => value !== null && value !== undefined && String(value).trim().length > 0,
    recordTitle: () => '',
    airtableRefetch: vi.fn(async () => {}),
    atLoading: false,
    atError: null,
    products: [],
    storeDomain: '',
    spLoading: false,
    spError: null,
    jfSubmissions: [],
    jfLoading: false,
    jfPolling: false,
    jfError: null,
    jfRefetch: vi.fn(),
    jfLastUpdated: null,
    jfFreshCount: 0,
    jfClearFresh: vi.fn(),
    approvalLoading: false,
    approvalError: null,
    approvalTotal: 0,
    approvalApproved: 0,
    approvalPending: 0,
    shopifyApprovalLoading: false,
    shopifyApprovalError: null,
    shopifyApprovalTotal: 0,
    shopifyApprovalApproved: 0,
    shopifyApprovalPending: 0,
    workflowDashboardTargets: {
      loading: false,
      error: null,
      pendingReviewOldestGroup: { id: null, label: null },
      progressOldestGroup: { id: null, label: null },
      refetch: vi.fn(),
    },
    workflowAnalytics: {
      loading: false,
      error: null,
      totalCount: 0,
      pendingReviewCount: 0,
      trashCount: 0,
      progressCount: 0,
      postPublishCount: 0,
      statusCounts: {
        'Pending Review': 0,
        'Unqualified': 0,
        'Accepted - Awaiting Arrival': 0,
        'Accepted - Arrived, Awaiting SKU': 0,
        'Accepted - Arrived, Awaiting Missing Item': 0,
        'Testing In Progress': 0,
        'Photography In Progress': 0,
        'Awaiting Pre-Listing Review': 0,
        'Approved for Publish': 0,
        'Listed, Shopify': 0,
        'Listed, eBay': 0,
        'Stale Listing, Shopify': 0,
        'Stale Listing, eBay': 0,
        'Sold - Ready to Ship': 0,
        'Shipped': 0,
      },
      marketplace: {
        shopifyLiveCount: 0,
        shopifyStaleCount: 0,
        ebayLiveCount: 0,
        ebayStaleCount: 0,
        soldReadyCount: 0,
        shippedCount: 0,
      },
      ownership: {
        pendingReviewMineCount: 0,
        pendingReviewUnassignedCount: 0,
        progressMineCount: 0,
        progressUnassignedCount: 0,
      },
      postSale: {
        exceptionCount: 0,
        unresolvedExceptionCount: 0,
        resolvedExceptionCount: 0,
        cancelledCount: 0,
        refundedCount: 0,
        returnedCount: 0,
        partialRefundCount: 0,
        returnReceivedCount: 0,
        refundExposure: 0,
        missingDispositionCount: 0,
      },
      age: {
        pendingReviewAlertCount: 0,
        oldestPendingReviewAgeDays: null,
        progressAlertCount: 0,
        oldestProgressAgeDays: null,
        activeNearStaleCount: 0,
        staleFollowUpCount: 0,
        oldestListedAgeDays: null,
        oldestStaleAgeDays: null,
      },
      lifecycle: {
        averageDaysToSell: null,
        averageDaysToShip: null,
        soldReadyAwaitingShipmentCount: 0,
        oldestSoldReadyAgeDays: null,
      },
      refetch: vi.fn(),
    },
    workflowPostPublishLoading: false,
    workflowPostPublishError: null,
    workflowActiveListingCount: 0,
    workflowStaleListingCount: 0,
    workflowStaleListingMineCount: 0,
    workflowStaleListingUnassignedCount: 0,
    workflowSoldReadyCount: 0,
    workflowSoldReadyMineCount: 0,
    workflowSoldReadyUnassignedCount: 0,
    workflowShippedCount: 0,
    ebayAuthenticated: false,
    ebayRestoringSession: false,
    ebayLoading: false,
    ebayError: null,
    ebayRuntimeConfig: null,
    ebayInventoryItems: [],
    ebayOffers: [],
    ebayRecentListings: [],
    ebayTotal: 0,
    ebayPublishedCount: 0,
    ebayDraftCount: 0,
    ebayRefetch: vi.fn(),
    sharkLoading: false,
    sharkError: null,
    sharkListings: [],
    sharkSearch: vi.fn(),
    currentSlug: '',
    ...overrides,
  };
}

describe('buildDashboardTabViewModel', () => {
  it('maps focused workflow dashboard actions into inventory deep links', () => {
    const navigateToInventoryWorkflowView = vi.fn();
    const viewModel = buildDashboardTabViewModel(buildInput({ navigateToInventoryWorkflowView }));

    viewModel.actions.onOpenInventoryWorkflowView('pending-review', { focusedGroupId: 'pickup-7' });

    expect(navigateToInventoryWorkflowView).toHaveBeenCalledWith('pending-review', { focusedGroupId: 'pickup-7' });
  });

  it('maps post-publish dashboard actions into inventory navigation options', () => {
    const navigateToInventoryPostPublishBucket = vi.fn();
    const viewModel = buildDashboardTabViewModel(buildInput({ navigateToInventoryPostPublishBucket }));

    viewModel.actions.onOpenInventoryPostPublishBucket('sold-ready');

    expect(navigateToInventoryPostPublishBucket).toHaveBeenCalledWith('sold-ready');
    expect(viewModel.workflow.currentUserName).toBe('Taylor Reviewer');
  });
});

describe('buildShopifyTabViewModel', () => {
  it('filters products to workflow-eligible listing SKUs', () => {
    const viewModel = buildShopifyTabViewModel(buildInput({
      nonEmptyListings: [
        {
          id: 'rec-ready',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            SKU: 'READY-SKU',
            'Workflow Status': 'Approved for Publish',
            Price: '2499',
          },
        },
      ],
      products: [
        {
          id: 1,
          title: 'Ready Product',
          variants: [{ sku: 'READY-SKU' }],
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
        {
          id: 2,
          title: 'Hidden Product',
          variants: [{ sku: 'HIDDEN-SKU' }],
          created_at: '2026-05-08T00:00:00.000Z',
          updated_at: '2026-05-08T00:00:00.000Z',
        },
      ],
    }));

    expect(viewModel.products.map((product) => product.title)).toEqual(['Ready Product']);
  });
});

describe('buildEbayTabViewModel', () => {
  it('filters live eBay inventory to workflow-eligible listing SKUs', () => {
    const viewModel = buildEbayTabViewModel(buildInput({
      nonEmptyListings: [
        {
          id: 'rec-ready',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            SKU: 'READY-SKU',
            'Workflow Status': 'Listed, eBay',
            Price: '2499',
          },
        },
      ],
      ebayAuthenticated: true,
      ebayInventoryItems: [
        { sku: 'READY-SKU' },
        { sku: 'HIDDEN-SKU' },
      ],
      ebayOffers: [
        { sku: 'READY-SKU', status: 'PUBLISHED' },
        { sku: 'HIDDEN-SKU', status: 'PUBLISHED' },
      ],
      ebayRecentListings: [
        { item: { sku: 'READY-SKU' }, offer: { sku: 'READY-SKU', status: 'PUBLISHED' } },
        { item: { sku: 'HIDDEN-SKU' }, offer: { sku: 'HIDDEN-SKU', status: 'PUBLISHED' } },
      ],
      ebayTotal: 2,
    }));

    expect(viewModel.inventory.items.map((item) => item.sku)).toEqual(['READY-SKU']);
    expect(viewModel.inventory.offers.map((offer) => offer.sku)).toEqual(['READY-SKU']);
    expect(viewModel.inventory.recentListings.map((listing) => listing.item.sku)).toEqual(['READY-SKU']);
    expect(viewModel.inventory.total).toBe(1);
  });

  it('uses the same workflow eligibility rule for Airtable-backed snapshots', () => {
    const viewModel = buildEbayTabViewModel(buildInput({
      runtimeFeatures: {
        jotform: { available: true, message: null, missingEnvNames: [] },
        ebay: { available: false, message: 'disabled', missingEnvNames: [] },
        approvalEbay: { available: true, message: null, missingEnvNames: [] },
        approvalShopify: { available: true, message: null, missingEnvNames: [] },
        approvalCombined: { available: true, message: null, missingEnvNames: [] },
      },
      nonEmptyListings: [
        {
          id: 'rec-ready',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            SKU: 'READY-SKU',
            'Workflow Status': 'Awaiting Pre-Listing Review',
            'eBay Inventory SKU': 'READY-SKU',
            'eBay Inventory Product Title': 'Visible listing',
            'eBay Offer Price Value': '2199',
          },
        },
        {
          id: 'rec-hidden',
          createdTime: '2026-05-08T00:00:00.000Z',
          fields: {
            SKU: 'HIDDEN-SKU',
            'Workflow Status': 'Testing In Progress',
            'eBay Inventory SKU': 'HIDDEN-SKU',
            'eBay Inventory Product Title': 'Hidden listing',
            'eBay Offer Price Value': '1999',
          },
        },
      ],
    }));

    expect(viewModel.snapshot.source).toBe('airtable');
    expect(viewModel.inventory.items.map((item) => item.sku)).toEqual(['READY-SKU']);
    expect(viewModel.inventory.total).toBe(1);
  });
});