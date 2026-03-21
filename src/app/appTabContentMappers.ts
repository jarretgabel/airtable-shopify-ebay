import type { AppTabContentProps } from '@/app/appTabContentTypes';

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
  | 'ebayInventoryItems'
  | 'ebayOffers'
  | 'ebayRecentListings'
  | 'ebayTotal'
  | 'ebayRefetch'
  | 'ebayDisconnect'
>;

export function buildEbayTabProps(input: EbayInput) {
  return {
    authenticated: input.ebayAuthenticated,
    restoringSession: input.ebayRestoringSession,
    loading: input.ebayLoading,
    error: input.ebayError,
    inventoryItems: input.ebayInventoryItems,
    offers: input.ebayOffers,
    recentListings: input.ebayRecentListings,
    total: input.ebayTotal,
    refetch: input.ebayRefetch,
    disconnect: input.ebayDisconnect,
  };
}

export function buildDashboardTabProps(input: AppTabInput) {
  const { metrics } = input;

  return {
    atLoading: input.atLoading,
    spLoading: input.spLoading,
    jfLoading: input.jfLoading,
    nonEmptyListings: input.nonEmptyListings,
    products: input.products,
    jfSubmissions: input.jfSubmissions,
    totalNewSubmissions: input.totalNewSubmissions,
    thisWeekSubs: metrics.thisWeekSubs,
    recentSubs: metrics.recentSubs,
    draftProducts: metrics.draftProducts,
    activeProducts: metrics.activeProducts,
    archivedProducts: metrics.archivedProducts,
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
    submissionDays: metrics.submissionDays,
    maxDayCount: metrics.maxDayCount,
    topBrands: metrics.topBrands,
    now: metrics.now,
    airtableInventoryValue: metrics.airtableInventoryValue,
    uniqueAirtableBrands: metrics.uniqueAirtableBrands,
    uniqueAirtableTypes: metrics.uniqueAirtableTypes,
    componentTypeSummary: metrics.componentTypeSummary,
    airtableBrandSummary: metrics.airtableBrandSummary,
    airtableDistributorSummary: metrics.airtableDistributorSummary,
    airtableTypeTable: metrics.airtableTypeTable,
    maxComponentTypeCount: metrics.maxComponentTypeCount,
    maxAirtableBrandCount: metrics.maxAirtableBrandCount,
    insights: metrics.insights,
    accessiblePages: input.accessiblePages,
    approvalLoading: input.approvalLoading,
    approvalError: input.approvalError,
    approvalTotal: input.approvalTotal,
    approvalApproved: input.approvalApproved,
    approvalPending: input.approvalPending,
    aiProvider: input.aiProvider,
    ebayAuthenticated: input.ebayAuthenticated,
    ebayRestoringSession: input.ebayRestoringSession,
    ebayLoading: input.ebayLoading,
    ebayError: input.ebayError,
    ebayTotal: input.ebayTotal,
    ebayPublishedCount: input.ebayPublishedCount,
    ebayDraftCount: input.ebayDraftCount,
    marketLoading: input.sharkLoading,
    marketError: input.sharkError?.message ?? null,
    marketCurrentSlug: input.currentSlug,
    marketListingCount: input.sharkListings.length,
    userCount: input.usersCount,
    adminCount: input.adminCount,
    onSelectTab: input.navigateToTab,
  };
}