import type { AppTabContentProps } from '@/app/appTabContentTypes';
import type {
  AirtableTabViewModel,
  ApprovalTabViewModel,
  DashboardTabViewModel,
  EbayTabViewModel,
  JotformTabViewModel,
  MarketTabViewModel,
  ShopifyTabViewModel,
  UserManagementTabViewModel,
} from '@/app/appTabViewModels';
import { buildEbaySnapshotFromAirtable } from '@/services/ebaySnapshotFromAirtable';
import { buildUsedGearWorkflowListingSkuSet } from '@/services/usedGearWorkflowListingVisibility';
import type { EbayPublishedListing } from '@/services/ebay/types';
import type { ShopifyProduct } from '@/types/shopify';

type AppTabInput = Pick<
  AppTabContentProps,
  | 'atLoading'
  | 'atError'
  | 'spLoading'
  | 'spError'
  | 'jfLoading'
  | 'jfError'
  | 'nonEmptyListings'
  | 'products'
  | 'jfSubmissions'
  | 'metrics'
  | 'accessiblePages'
  | 'currentUserRole'
  | 'currentUserName'
  | 'approvalLoading'
  | 'approvalError'
  | 'approvalTotal'
  | 'approvalApproved'
  | 'approvalPending'
  | 'shopifyApprovalLoading'
  | 'shopifyApprovalError'
  | 'shopifyApprovalTotal'
  | 'shopifyApprovalApproved'
  | 'shopifyApprovalPending'
  | 'workflowDashboardTargets'
  | 'workflowAnalytics'
  | 'workflowPostPublishLoading'
  | 'workflowPostPublishError'
  | 'workflowActiveListingCount'
  | 'workflowStaleListingCount'
  | 'workflowStaleListingMineCount'
  | 'workflowStaleListingUnassignedCount'
  | 'workflowSoldReadyCount'
  | 'workflowSoldReadyMineCount'
  | 'workflowSoldReadyUnassignedCount'
  | 'workflowShippedCount'
  | 'aiProvider'
  | 'ebayAuthenticated'
  | 'ebayRestoringSession'
  | 'ebayLoading'
  | 'ebayError'
  | 'ebayTotal'
  | 'ebayPublishedCount'
  | 'ebayDraftCount'
  | 'sharkLoading'
  | 'sharkError'
  | 'currentSlug'
  | 'sharkListings'
  | 'usersCount'
  | 'adminCount'
  | 'runtimeFeatures'
  | 'navigateToTab'
  | 'navigateToInventoryWorkflowView'
  | 'navigateToInventoryPostPublishBucket'
>;

type EbayInput = Pick<
  AppTabContentProps,
  | 'ebayAuthenticated'
  | 'ebayRestoringSession'
  | 'ebayLoading'
  | 'ebayError'
  | 'ebayRuntimeConfig'
  | 'ebayInventoryItems'
  | 'ebayOffers'
  | 'ebayRecentListings'
  | 'ebayTotal'
  | 'ebayRefetch'
  | 'airtableRefetch'
  | 'nonEmptyListings'
  | 'runtimeFeatures'
>;

type AirtableInput = Pick<
  AppTabContentProps,
  'atLoading' | 'atError' | 'nonEmptyListings' | 'displayValue' | 'hasValue' | 'recordTitle'
>;

type ShopifyInput = Pick<
  AppTabContentProps,
  'spLoading' | 'spError' | 'products' | 'storeDomain' | 'nonEmptyListings'
>;

type MarketInput = Pick<
  AppTabContentProps,
  'sharkLoading' | 'sharkError' | 'sharkListings' | 'currentSlug' | 'sharkSearch'
>;

type JotformInput = Pick<
  AppTabContentProps,
  'jfSubmissions' | 'jfLoading' | 'jfPolling' | 'jfError' | 'jfRefetch' | 'jfLastUpdated' | 'jfFreshCount' | 'jfClearFresh'
>;

interface ApprovalInput {
  approvalRecordId: string | null;
  navigateToApprovalRecord: (recordId: string, replace?: boolean) => void;
  navigateToApprovalList: (replace?: boolean) => void;
  navigateToOperationalRecord?: (recordId: string, replace?: boolean) => void;
  navigateToTestingForm?: (recordId?: string | null, replace?: boolean) => void;
  navigateToPhotosForm?: (recordId?: string | null, replace?: boolean) => void;
}

type UsersInput = Pick<
  AppTabContentProps,
  'userRecordId' | 'navigateToUserRecord' | 'navigateToUsersList'
>;

export function buildEbayTabViewModel(input: EbayInput): EbayTabViewModel {
  const eligibleListingSkus = buildUsedGearWorkflowListingSkuSet(input.nonEmptyListings);
  const airtableSnapshot = buildEbaySnapshotFromAirtable(input.nonEmptyListings);
  const useAirtableSnapshot = !input.runtimeFeatures.ebay.available;
  const filteredItems = useAirtableSnapshot
    ? airtableSnapshot.items
    : input.ebayInventoryItems.filter((item) => eligibleListingSkus.has(item.sku));
  const filteredOffers = useAirtableSnapshot
    ? airtableSnapshot.offers
    : input.ebayOffers.filter((offer) => eligibleListingSkus.has(offer.sku));
  const filteredRecentListings = useAirtableSnapshot
    ? airtableSnapshot.recentListings
    : input.ebayRecentListings.filter((listing) => eligibleListingSkus.has(listing.item.sku) || eligibleListingSkus.has(listing.offer.sku));
  const filteredTotal = useAirtableSnapshot
    ? airtableSnapshot.total
    : countUniqueEbaySkus(filteredItems, filteredOffers, filteredRecentListings);

  return {
    session: {
      authenticated: input.ebayAuthenticated,
      restoringSession: input.ebayRestoringSession,
    },
    state: {
      loading: useAirtableSnapshot ? false : input.ebayLoading,
      error: useAirtableSnapshot ? null : input.ebayError,
    },
    config: {
      runtimeConfig: useAirtableSnapshot ? null : input.ebayRuntimeConfig,
    },
    snapshot: {
      source: useAirtableSnapshot ? 'airtable' : 'live',
    },
    inventory: {
      items: filteredItems,
      offers: filteredOffers,
      recentListings: filteredRecentListings,
      total: filteredTotal,
    },
    actions: {
      refetch: useAirtableSnapshot ? () => { void input.airtableRefetch(); } : input.ebayRefetch,
    },
  };
}

export function buildDashboardTabViewModel(input: AppTabInput): DashboardTabViewModel {
  const { metrics } = input;

  return {
    loading: {
      airtable: input.atLoading,
      shopify: input.spLoading,
      jotform: input.jfLoading,
      approval: input.approvalLoading,
      ebay: input.ebayLoading,
      market: input.sharkLoading,
    },
    data: {
      nonEmptyListings: input.nonEmptyListings,
      products: input.products,
      jfSubmissions: input.jfSubmissions,
      thisWeekSubs: metrics.thisWeekSubs,
      recentSubs: metrics.recentSubs,
      draftProducts: metrics.draftProducts,
      activeProducts: metrics.activeProducts,
      archivedProducts: metrics.archivedProducts,
      submissionDays: metrics.submissionDays,
      topBrands: metrics.topBrands,
      now: metrics.now,
      insights: metrics.insights,
      componentTypeSummary: metrics.componentTypeSummary,
      airtableBrandSummary: metrics.airtableBrandSummary,
      airtableDistributorSummary: metrics.airtableDistributorSummary,
      airtableTypeTable: metrics.airtableTypeTable,
    },
    kpis: {
      acquisitionCost: metrics.acquisitionCost,
      inventoryValue: metrics.inventoryValue,
      avgAskPrice: metrics.avgAskPrice,
      sellThroughPct: metrics.sellThroughPct,
      grossMarginPct: metrics.grossMarginPct,
      submissionsTrend: metrics.submissionsTrend,
      dealsTrend: metrics.dealsTrend,
      acquisitionTrend: metrics.acquisitionTrend,
      inventoryTrend: metrics.inventoryTrend,
      salesTrend: metrics.salesTrend,
      marginTrend: metrics.marginTrend,
      maxDayCount: metrics.maxDayCount,
      airtableInventoryValue: metrics.airtableInventoryValue,
      uniqueAirtableBrands: metrics.uniqueAirtableBrands,
      uniqueAirtableTypes: metrics.uniqueAirtableTypes,
      maxComponentTypeCount: metrics.maxComponentTypeCount,
      maxAirtableBrandCount: metrics.maxAirtableBrandCount,
    },
    workflow: {
      accessiblePages: input.accessiblePages,
      approvalError: input.approvalError,
      approvalTotal: input.approvalTotal,
      approvalApproved: input.approvalApproved,
      approvalPending: input.approvalPending,
      shopifyApprovalLoading: input.shopifyApprovalLoading,
      shopifyApprovalError: input.shopifyApprovalError,
      shopifyApprovalTotal: input.shopifyApprovalTotal,
      shopifyApprovalApproved: input.shopifyApprovalApproved,
      shopifyApprovalPending: input.shopifyApprovalPending,
      workflowDashboardTargets: input.workflowDashboardTargets,
      workflowAnalytics: input.workflowAnalytics,
      workflowPostPublishLoading: input.workflowPostPublishLoading,
      workflowPostPublishError: input.workflowPostPublishError,
      workflowActiveListingCount: input.workflowActiveListingCount,
      workflowStaleListingCount: input.workflowStaleListingCount,
      workflowStaleListingMineCount: input.workflowStaleListingMineCount,
      workflowStaleListingUnassignedCount: input.workflowStaleListingUnassignedCount,
      workflowSoldReadyCount: input.workflowSoldReadyCount,
      workflowSoldReadyMineCount: input.workflowSoldReadyMineCount,
      workflowSoldReadyUnassignedCount: input.workflowSoldReadyUnassignedCount,
      workflowShippedCount: input.workflowShippedCount,
      aiProvider: input.aiProvider,
      ebayAuthenticated: input.ebayAuthenticated,
      ebayRestoringSession: input.ebayRestoringSession,
      ebayError: input.ebayError,
      ebayTotal: input.ebayTotal,
      ebayPublishedCount: input.ebayPublishedCount,
      ebayDraftCount: input.ebayDraftCount,
      marketError: input.sharkError?.message ?? null,
      marketCurrentSlug: input.currentSlug,
      marketListingCount: input.sharkListings.length,
      userCount: input.usersCount,
      adminCount: input.adminCount,
      currentUserRole: input.currentUserRole,
      currentUserName: input.currentUserName,
      canViewSensitiveMetrics: input.currentUserRole === 'owner',
    },
    status: {
      sources: [
        { key: 'airtable', label: 'Inventory', error: input.atError?.message ?? null, hasData: input.nonEmptyListings.length > 0 },
        { key: 'shopify', label: 'Shopify', error: input.spError?.message ?? null, hasData: input.products.length > 0 },
        { key: 'jotform', label: 'JotForm', error: input.runtimeFeatures.jotform.message ?? input.jfError?.message ?? null, hasData: input.jfSubmissions.length > 0 },
        { key: 'listings-ebay', label: 'eBay Listings Review', error: input.runtimeFeatures.approvalEbay.message ?? input.approvalError, hasData: input.approvalTotal > 0 },
        { key: 'listings-shopify', label: 'Shopify Listings Review', error: input.runtimeFeatures.approvalShopify.message ?? input.shopifyApprovalError, hasData: input.shopifyApprovalTotal > 0 },
        { key: 'ebay', label: 'eBay', error: input.runtimeFeatures.ebay.message ?? input.ebayError, hasData: input.ebayTotal > 0 },
        { key: 'market', label: 'Market Research', error: input.sharkError?.message ?? null, hasData: input.sharkListings.length > 0 || Boolean(input.currentSlug) },
      ],
    },
    actions: {
      onSelectTab: input.navigateToTab,
      onOpenInventoryWorkflowView: (view, options) => {
        input.navigateToInventoryWorkflowView(
          view,
          options,
        );
      },
      onOpenInventoryPostPublishBucket: (bucket) => {
        input.navigateToInventoryPostPublishBucket(
          bucket,
        );
      },
    },
  };
}

export function buildAirtableTabViewModel(input: AirtableInput): AirtableTabViewModel {
  return {
    loading: input.atLoading,
    error: input.atError,
    listings: input.nonEmptyListings,
    displayValue: input.displayValue,
    hasValue: input.hasValue,
    recordTitle: input.recordTitle,
  };
}

export function buildShopifyTabViewModel(input: ShopifyInput): ShopifyTabViewModel {
  const eligibleListingSkus = buildUsedGearWorkflowListingSkuSet(input.nonEmptyListings);

  return {
    loading: input.spLoading,
    error: input.spError,
    products: input.products.filter((product) => productHasEligibleWorkflowSku(product, eligibleListingSkus)),
    storeDomain: input.storeDomain,
  };
}

export function buildMarketTabViewModel(input: MarketInput): MarketTabViewModel {
  return {
    loading: input.sharkLoading,
    error: input.sharkError,
    listings: input.sharkListings,
    currentSlug: input.currentSlug,
    onSearch: input.sharkSearch,
  };
}

export function buildJotformTabViewModel(input: JotformInput): JotformTabViewModel {
  return {
    submissions: input.jfSubmissions,
    loading: input.jfLoading,
    polling: input.jfPolling,
    error: input.jfError,
    refetch: input.jfRefetch,
    lastUpdated: input.jfLastUpdated,
    freshCount: input.jfFreshCount,
    clearFresh: input.jfClearFresh,
  };
}

export function buildApprovalTabViewModel(input: ApprovalInput): ApprovalTabViewModel {
  return {
    selectedRecordId: input.approvalRecordId,
    onSelectRecord: (recordId) => input.navigateToApprovalRecord(recordId),
    onBackToList: () => input.navigateToApprovalList(),
    onOpenOperationalRecord: input.navigateToOperationalRecord
      ? (recordId) => input.navigateToOperationalRecord?.(recordId)
      : undefined,
    onOpenTestingForm: input.navigateToTestingForm
      ? (recordId) => input.navigateToTestingForm?.(recordId)
      : undefined,
    onOpenPhotosForm: input.navigateToPhotosForm
      ? (recordId) => input.navigateToPhotosForm?.(recordId)
      : undefined,
  };
}

export function buildUsersTabViewModel(input: UsersInput): UserManagementTabViewModel {
  return {
    selectedUserId: input.userRecordId,
    onSelectUser: (userId) => input.navigateToUserRecord(userId),
    onBackToList: () => input.navigateToUsersList(),
  };
}

function productHasEligibleWorkflowSku(product: ShopifyProduct, eligibleListingSkus: Set<string>): boolean {
  return (product.variants ?? []).some((variant) => {
    const sku = variant.sku?.trim();
    return Boolean(sku && eligibleListingSkus.has(sku));
  });
}

function countUniqueEbaySkus(
  items: EbayTabViewModel['inventory']['items'],
  offers: EbayTabViewModel['inventory']['offers'],
  recentListings: EbayPublishedListing[],
): number {
  const uniqueSkus = new Set<string>();

  items.forEach((item) => {
    if (item.sku) {
      uniqueSkus.add(item.sku);
    }
  });
  offers.forEach((offer) => {
    if (offer.sku) {
      uniqueSkus.add(offer.sku);
    }
  });
  recentListings.forEach((listing) => {
    if (listing.item.sku) {
      uniqueSkus.add(listing.item.sku);
    }
    if (listing.offer.sku) {
      uniqueSkus.add(listing.offer.sku);
    }
  });

  return uniqueSkus.size;
}