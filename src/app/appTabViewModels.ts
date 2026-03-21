import type { DashboardTargetTab, DashboardInsight, ShopifyProduct, TrendSummary, AirtableTypeRow, AirtableListing } from '@/components/dashboard/dashboardTabTypes';
import type { AppPage } from '@/auth/pages';
import type { Tab } from '@/app/appNavigation';
import type { JotFormSubmission } from '@/types/jotform';
import type { HiFiSharkListing } from '@/types/hifishark';
import type { EbayListingsState } from '@/hooks/useEbayListings';
import type { useShopifyProducts } from '@/hooks/useShopifyProducts';

export interface DashboardTabViewModel {
  loading: {
    airtable: boolean;
    shopify: boolean;
    jotform: boolean;
    approval: boolean;
    ebay: boolean;
    market: boolean;
  };
  data: {
    nonEmptyListings: AirtableListing[];
    products: ShopifyProduct[];
    jfSubmissions: JotFormSubmission[];
    thisWeekSubs: JotFormSubmission[];
    recentSubs: JotFormSubmission[];
    draftProducts: ShopifyProduct[];
    activeProducts: ShopifyProduct[];
    archivedProducts: ShopifyProduct[];
    submissionDays: Array<{ label: string; count: number }>;
    topBrands: Array<[string, number]>;
    now: number;
    insights: DashboardInsight[];
    componentTypeSummary: Array<[string, number]>;
    airtableBrandSummary: Array<[string, number]>;
    airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
    airtableTypeTable: AirtableTypeRow[];
  };
  kpis: {
    totalNewSubmissions: number;
    acquisitionCost: number;
    inventoryValue: number;
    avgAskPrice: number;
    sellThroughPct: number | null;
    grossMarginPct: number | null;
    submissionsTrend: TrendSummary;
    dealsTrend: TrendSummary;
    acquisitionTrend: TrendSummary;
    inventoryTrend: TrendSummary;
    salesTrend: TrendSummary;
    marginTrend: TrendSummary;
    maxDayCount: number;
    airtableInventoryValue: number;
    uniqueAirtableBrands: number;
    uniqueAirtableTypes: number;
    maxComponentTypeCount: number;
    maxAirtableBrandCount: number;
  };
  workflow: {
    accessiblePages: AppPage[];
    approvalError: string | null;
    approvalTotal: number;
    approvalApproved: number;
    approvalPending: number;
    shopifyApprovalLoading: boolean;
    shopifyApprovalError: string | null;
    shopifyApprovalTotal: number;
    shopifyApprovalApproved: number;
    shopifyApprovalPending: number;
    aiProvider: 'github' | 'openai' | 'none';
    ebayAuthenticated: boolean;
    ebayRestoringSession: boolean;
    ebayError: string | null;
    ebayTotal: number;
    ebayPublishedCount: number;
    ebayDraftCount: number;
    marketError: string | null;
    marketCurrentSlug: string;
    marketListingCount: number;
    userCount: number;
    adminCount: number;
  };
  actions: {
    onSelectTab: (tab: DashboardTargetTab) => void;
  };
}

export interface EbayTabViewModel {
  session: {
    authenticated: boolean;
    restoringSession: boolean;
  };
  state: {
    loading: boolean;
    error: string | null;
  };
  inventory: {
    items: EbayListingsState['inventoryItems'];
    offers: EbayListingsState['offers'];
    recentListings: EbayListingsState['recentListings'];
    total: number;
  };
  actions: {
    refetch: () => void;
    disconnect: () => void;
  };
}

export interface AirtableTabViewModel {
  loading: boolean;
  error: Error | null;
  listings: AirtableListing[];
  displayValue: (value: unknown) => string;
  hasValue: (value: unknown) => boolean;
  recordTitle: (fields: Record<string, unknown>) => string;
}

export interface ShopifyTabViewModel {
  loading: boolean;
  error: Error | null;
  products: ReturnType<typeof useShopifyProducts>['products'];
  storeDomain?: string;
}

export interface MarketTabViewModel {
  loading: boolean;
  error: Error | null;
  listings: HiFiSharkListing[];
  currentSlug: string;
  onSearch: (slug: string) => void;
}

export interface JotformTabViewModel {
  submissions: JotFormSubmission[];
  loading: boolean;
  polling: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
  freshCount: number;
  clearFresh: () => void;
}

export interface ApprovalTabViewModel {
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
  onBackToList: () => void;
}

export interface UserManagementTabViewModel {
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onBackToList: () => void;
}

export interface AppTabContentViewModels {
  dashboard: DashboardTabViewModel;
  ebay: EbayTabViewModel;
  airtable: AirtableTabViewModel;
  shopify: ShopifyTabViewModel;
  market: MarketTabViewModel;
  jotform: JotformTabViewModel;
  approval: ApprovalTabViewModel;
  users: UserManagementTabViewModel;
}

export interface AppTabRouteViewModel {
  activeTab: Tab;
}
