import { JotFormSubmission } from '@/types/jotform';
import { ShopifyProduct } from '@/types/shopify';

export type ShopifyProductFull = ShopifyProduct & {
  id: number;
  created_at: string;
  updated_at: string;
};

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendSummary {
  direction: TrendDirection;
  text: string;
}

export type DashboardInsightSeverity = 'critical' | 'warning' | 'info' | 'positive';
export type DashboardInsightTargetTab = 'jotform' | 'shopify' | 'inventory';

export interface DashboardInsight {
  id: string;
  title: string;
  detail: string;
  severity: DashboardInsightSeverity;
  targetTab?: DashboardInsightTargetTab;
}

export interface DashboardMetrics {
  now: number;
  thisWeekSubs: JotFormSubmission[];
  recentSubs: JotFormSubmission[];
  draftProducts: ShopifyProductFull[];
  activeProducts: ShopifyProductFull[];
  archivedProducts: ShopifyProductFull[];
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
  airtableInventoryValue: number;
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  componentTypeSummary: Array<[string, number]>;
  airtableBrandSummary: Array<[string, number]>;
  airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
  airtableTypeTable: Array<{
    type: string;
    count: number;
    brandCount: number;
    averagePrice: number;
    totalPrice: number;
  }>;
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
  insights: DashboardInsight[];
}
