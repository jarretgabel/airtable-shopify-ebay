import type { AppPage } from '@/auth/pages';
import type { JotFormSubmission } from '@/types/jotform';

export type DashboardTargetTab = AppPage;

export interface TrendSummary {
  direction: 'up' | 'down' | 'flat';
  text: string;
}

export interface AirtableListing {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface ShopifyVariant {
  price?: string;
  inventory_quantity?: number;
}

export interface ShopifyProduct {
  id: number;
  status?: string;
  created_at?: string;
  updated_at?: string;
  variants?: ShopifyVariant[];
}

export interface AirtableTypeRow {
  type: string;
  count: number;
  brandCount: number;
  averagePrice: number;
  totalPrice: number;
}

export interface DashboardInsight {
  id: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  targetTab?: DashboardTargetTab;
}

export interface WorkflowCard {
  id: AppPage;
  title: string;
  eyebrow: string;
  detail: string;
  stats: string[];
}

export type DashboardSectionId =
  | 'overview'
  | 'insights'
  | 'inventory'
  | 'pipeline'
  | 'inquiries'
  | 'ebay-workflows'
  | 'market-research'
  | 'utility-workflows';

export interface DashboardSection {
  id: DashboardSectionId;
  label: string;
}

export interface DashboardTabProps {
  atLoading: boolean;
  spLoading: boolean;
  jfLoading: boolean;
  nonEmptyListings: AirtableListing[];
  products: ShopifyProduct[];
  jfSubmissions: JotFormSubmission[];
  totalNewSubmissions: number;
  thisWeekSubs: JotFormSubmission[];
  recentSubs: JotFormSubmission[];
  draftProducts: ShopifyProduct[];
  activeProducts: ShopifyProduct[];
  archivedProducts: ShopifyProduct[];
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
  submissionDays: Array<{ label: string; count: number }>;
  maxDayCount: number;
  topBrands: Array<[string, number]>;
  now: number;
  airtableInventoryValue: number;
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  componentTypeSummary: Array<[string, number]>;
  airtableBrandSummary: Array<[string, number]>;
  airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
  airtableTypeTable: AirtableTypeRow[];
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
  insights: DashboardInsight[];
  accessiblePages: AppPage[];
  approvalLoading: boolean;
  approvalError: string | null;
  approvalTotal: number;
  approvalApproved: number;
  approvalPending: number;
  aiProvider: 'github' | 'openai' | 'none';
  ebayAuthenticated: boolean;
  ebayRestoringSession: boolean;
  ebayLoading: boolean;
  ebayError: string | null;
  ebayTotal: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
  marketLoading: boolean;
  marketError: string | null;
  marketCurrentSlug: string;
  marketListingCount: number;
  userCount: number;
  adminCount: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}
