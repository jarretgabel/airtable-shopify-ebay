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

type AppTabInput = Pick<
  AppTabContentProps,
  | 'atLoading'
  | 'spLoading'
  | 'jfLoading'
  | 'nonEmptyListings'
  | 'products'
  | 'jfSubmissions'
  | 'totalNewSubmissions'
  | 'metrics'
  | 'accessiblePages'
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
  | 'navigateToTab'
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
>;

type AirtableInput = Pick<
  AppTabContentProps,
  'atLoading' | 'atError' | 'nonEmptyListings' | 'displayValue' | 'hasValue' | 'recordTitle'
>;

type ShopifyInput = Pick<
  AppTabContentProps,
  'spLoading' | 'spError' | 'products' | 'storeDomain'
>;

type MarketInput = Pick<
  AppTabContentProps,
  'sharkLoading' | 'sharkError' | 'sharkListings' | 'currentSlug' | 'sharkSearch'
>;

type JotformInput = Pick<
  AppTabContentProps,
  'jfSubmissions' | 'jfLoading' | 'jfPolling' | 'jfError' | 'jfRefetch' | 'jfLastUpdated' | 'jfFreshCount' | 'jfClearFresh'
>;

type ApprovalInput = Pick<
  AppTabContentProps,
  'approvalRecordId' | 'navigateToApprovalRecord' | 'navigateToApprovalList'
>;

type UsersInput = Pick<
  AppTabContentProps,
  'userRecordId' | 'navigateToUserRecord' | 'navigateToUsersList'
>;

export function buildEbayTabViewModel(input: EbayInput): EbayTabViewModel {
  return {
    session: {
      authenticated: input.ebayAuthenticated,
      restoringSession: input.ebayRestoringSession,
    },
    state: {
      loading: input.ebayLoading,
      error: input.ebayError,
    },
    config: {
      runtimeConfig: input.ebayRuntimeConfig,
    },
    inventory: {
      items: input.ebayInventoryItems,
      offers: input.ebayOffers,
      recentListings: input.ebayRecentListings,
      total: input.ebayTotal,
    },
    actions: {
      refetch: input.ebayRefetch,
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
      totalNewSubmissions: input.totalNewSubmissions,
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
    },
    actions: {
      onSelectTab: input.navigateToTab,
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
  return {
    loading: input.spLoading,
    error: input.spError,
    products: input.products,
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
  };
}

export function buildUsersTabViewModel(input: UsersInput): UserManagementTabViewModel {
  return {
    selectedUserId: input.userRecordId,
    onSelectUser: (userId) => input.navigateToUserRecord(userId),
    onBackToList: () => input.navigateToUsersList(),
  };
}