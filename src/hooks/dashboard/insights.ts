import { AirtableRecord } from '@/types/airtable';
import { JotFormSubmission } from '@/types/jotform';
import { DashboardInsight, DashboardInsightSeverity, ShopifyProductFull } from './metricsTypes';
import { parseDateValue } from './metricUtils';

interface InsightInput {
  recentSubs: JotFormSubmission[];
  priorRecentSubs: JotFormSubmission[];
  draftProducts: ShopifyProductFull[];
  activeProducts: ShopifyProductFull[];
  recentArchivedProducts: ShopifyProductFull[];
  priorArchivedProducts: ShopifyProductFull[];
  airtableBrandSummary: Array<[string, number]>;
  nonEmptyListings: AirtableRecord[];
  workflowStaleListingCount: number;
  workflowStaleListingUnassignedCount: number;
  workflowSoldReadyCount: number;
  workflowSoldReadyUnassignedCount: number;
  now: number;
}

const severityOrder: Record<DashboardInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export function buildDashboardInsights(input: InsightInput): DashboardInsight[] {
  const {
    recentSubs,
    priorRecentSubs,
    draftProducts,
    activeProducts,
    recentArchivedProducts,
    priorArchivedProducts,
    airtableBrandSummary,
    nonEmptyListings,
    workflowStaleListingCount,
    workflowSoldReadyCount,
    now,
  } = input;

  const staleActiveProducts = activeProducts.filter((product) => {
    const createdAt = parseDateValue(product.created_at);
    if (!createdAt) return false;
    return now - createdAt > 90 * 24 * 60 * 60 * 1000;
  });

  const insights: DashboardInsight[] = [];

  if (draftProducts.length >= 10 && draftProducts.length >= activeProducts.length) {
    insights.push({
      id: 'draft-backlog',
      title: 'Listing pipeline is draft-heavy',
      detail: `${draftProducts.length} drafts vs ${activeProducts.length} active listings suggests publishing bottlenecks.`,
      severity: 'warning',
      targetTab: 'shopify',
    });
  }

  if (workflowSoldReadyCount > 0) {
    insights.push({
      id: 'used-gear-sold-ready',
      title: 'Used gear ready to ship',
      detail: `${workflowSoldReadyCount} used-gear item${workflowSoldReadyCount === 1 ? ' is' : 's are'} sold and ready to ship.`,
      severity: 'critical',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'sold-ready',
    });
  }

  if (workflowStaleListingCount > 0) {
    insights.push({
      id: 'used-gear-stale-listings',
      title: 'Used gear listings went stale',
      detail: `${workflowStaleListingCount} used-gear listing${workflowStaleListingCount === 1 ? ' has' : 's have'} crossed into stale review.`,
      severity: workflowStaleListingCount >= 3 ? 'warning' : 'info',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'stale-listing',
    });
  }

  if (activeProducts.length >= 5 && staleActiveProducts.length / activeProducts.length >= 0.4) {
    insights.push({
      id: 'stale-inventory',
      title: 'Inventory aging risk detected',
      detail: `${staleActiveProducts.length} active listings are older than 90 days.`,
      severity: 'info',
      targetTab: 'shopify',
    });
  }

  if (priorArchivedProducts.length >= 3 && recentArchivedProducts.length === 0) {
    insights.push({
      id: 'sales-slowdown',
      title: 'Recent sales activity slowed',
      detail: 'No archived/sold listings in the last 30 days despite prior movement.',
      severity: 'warning',
      targetTab: 'shopify',
    });
  }

  if (airtableBrandSummary.length > 0) {
    const topBrandShare = airtableBrandSummary[0][1] / Math.max(nonEmptyListings.length, 1);
    if (topBrandShare >= 0.45) {
      insights.push({
        id: 'brand-concentration',
        title: 'Inventory concentration risk',
        detail: `${airtableBrandSummary[0][0]} accounts for ${Math.round(topBrandShare * 100)}% of Airtable inventory.`,
        severity: 'info',
        targetTab: 'inventory',
      });
    }
  }

  if (recentSubs.length > priorRecentSubs.length && recentArchivedProducts.length > priorArchivedProducts.length) {
    insights.push({
      id: 'positive-momentum',
      title: 'Pipeline momentum is positive',
      detail: 'Inbound inquiries and recent closes are both trending upward.',
      severity: 'positive',
    });
  }

  return insights
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 6);
}
