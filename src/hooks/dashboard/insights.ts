import { AirtableRecord } from '@/types/airtable';
import { JotFormSubmission } from '@/types/jotform';
import { DashboardInsight, DashboardInsightSeverity, ShopifyProductFull } from './metricsTypes';
import { parseDateValue } from './metricUtils';

interface InsightInput {
  jfSubmissions: JotFormSubmission[];
  recentSubs: JotFormSubmission[];
  priorRecentSubs: JotFormSubmission[];
  draftProducts: ShopifyProductFull[];
  activeProducts: ShopifyProductFull[];
  recentArchivedProducts: ShopifyProductFull[];
  priorArchivedProducts: ShopifyProductFull[];
  airtableBrandSummary: Array<[string, number]>;
  nonEmptyListings: AirtableRecord[];
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
    jfSubmissions,
    recentSubs,
    priorRecentSubs,
    draftProducts,
    activeProducts,
    recentArchivedProducts,
    priorArchivedProducts,
    airtableBrandSummary,
    nonEmptyListings,
    now,
  } = input;

  const unreadCount = jfSubmissions.filter((submission) => submission.new === '1').length;
  const staleActiveProducts = activeProducts.filter((product) => {
    const createdAt = parseDateValue(product.created_at);
    if (!createdAt) return false;
    return now - createdAt > 90 * 24 * 60 * 60 * 1000;
  });

  const insights: DashboardInsight[] = [];

  if (priorRecentSubs.length >= 5 && recentSubs.length <= Math.floor(priorRecentSubs.length * 0.6)) {
    insights.push({
      id: 'inquiry-drop',
      title: 'Inquiry volume dropped',
      detail: `Last 30 days received ${recentSubs.length} inquiries vs ${priorRecentSubs.length} in the prior window.`,
      severity: 'warning',
      targetTab: 'jotform',
    });
  }

  if (unreadCount >= 20) {
    insights.push({
      id: 'unread-backlog-critical',
      title: 'Inquiry backlog is high',
      detail: `${unreadCount} unread inquiries need triage.`,
      severity: 'critical',
      targetTab: 'jotform',
    });
  } else if (unreadCount >= 8) {
    insights.push({
      id: 'unread-backlog-warning',
      title: 'Inquiry backlog is growing',
      detail: `${unreadCount} inquiries are still unread.`,
      severity: 'warning',
      targetTab: 'jotform',
    });
  }

  if (draftProducts.length >= 10 && draftProducts.length >= activeProducts.length) {
    insights.push({
      id: 'draft-backlog',
      title: 'Listing pipeline is draft-heavy',
      detail: `${draftProducts.length} drafts vs ${activeProducts.length} active listings suggests publishing bottlenecks.`,
      severity: 'warning',
      targetTab: 'shopify',
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
