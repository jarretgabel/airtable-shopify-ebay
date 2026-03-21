import { useMemo } from 'react';
import { formatAnswer } from '@/services/jotform';
import { AirtableRecord } from '@/types/airtable';
import { JotFormSubmission } from '@/types/jotform';
import { ShopifyProduct } from '@/types/shopify';

type ShopifyProductFull = ShopifyProduct & { id: number; created_at: string; updated_at: string };

type TrendDirection = 'up' | 'down' | 'flat';

interface TrendSummary {
  direction: TrendDirection;
  text: string;
}

export type DashboardInsightSeverity = 'critical' | 'warning' | 'info' | 'positive';
export type DashboardInsightTargetTab = 'jotform' | 'shopify' | 'airtable';

export interface DashboardInsight {
  id: string;
  title: string;
  detail: string;
  severity: DashboardInsightSeverity;
  targetTab?: DashboardInsightTargetTab;
}

interface DashboardMetrics {
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
  airtableTypeTable: Array<{ type: string; count: number; brandCount: number; averagePrice: number; totalPrice: number }>;
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
  insights: DashboardInsight[];
}

function parseCurrencyAmount(value: unknown): number {
  const raw = String(value ?? '').replace(/[^0-9.]/g, '');
  return parseFloat(raw) || 0;
}

function parseDateValue(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(String(value)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isWithinWindow(timestamp: number | null, start: number, end: number): boolean {
  return timestamp !== null && timestamp >= start && timestamp < end;
}

function getTrendSummary(current: number, previous: number, label: string): TrendSummary {
  if (current === 0 && previous === 0) {
    return { direction: 'flat', text: `Flat vs prior ${label}` };
  }

  if (previous === 0) {
    return { direction: 'up', text: `Up from 0 vs prior ${label}` };
  }

  const changePct = Math.round(((current - previous) / previous) * 100);
  if (changePct === 0) {
    return { direction: 'flat', text: `Flat vs prior ${label}` };
  }

  return {
    direction: changePct > 0 ? 'up' : 'down',
    text: `${changePct > 0 ? 'Up' : 'Down'} ${Math.abs(changePct)}% vs prior ${label}`,
  };
}

export function useDashboardMetrics(nonEmptyListings: AirtableRecord[], products: ShopifyProductFull[], jfSubmissions: JotFormSubmission[]): DashboardMetrics {
  return useMemo(() => {
    const now = Date.now();
    const MS_30D = 30 * 24 * 60 * 60 * 1000;
    const MS_7D = 7 * 24 * 60 * 60 * 1000;
    const current30dStart = now - MS_30D;
    const previous30dStart = now - (MS_30D * 2);

    const recentSubs = jfSubmissions.filter((submission) => now - new Date(submission.created_at).getTime() < MS_30D);
    const thisWeekSubs = jfSubmissions.filter((submission) => now - new Date(submission.created_at).getTime() < MS_7D);
    const priorRecentSubs = jfSubmissions.filter((submission) => {
      const createdAt = parseDateValue(submission.created_at);
      return isWithinWindow(createdAt, previous30dStart, current30dStart);
    });

    const draftProducts = products.filter((product) => product.status === 'draft');
    const activeProducts = products.filter((product) => product.status === 'active');
    const archivedProducts = products.filter((product) => product.status === 'archived');
    const recentDraftProducts = draftProducts.filter((product) => isWithinWindow(parseDateValue(product.created_at), current30dStart, now));
    const priorDraftProducts = draftProducts.filter((product) => isWithinWindow(parseDateValue(product.created_at), previous30dStart, current30dStart));

    const inventoryValue = products.reduce((sum, product) => {
      if (product.status !== 'active') return sum;
      const price = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
      const qty = product.variants?.[0]?.inventory_quantity ?? 1;
      return sum + price * Math.max(qty, 1);
    }, 0);

    const acquisitionCost = nonEmptyListings.reduce((sum, listing) => {
      return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
    }, 0);

    const recentAcquisitionCost = nonEmptyListings.reduce((sum, listing) => {
      if (!isWithinWindow(parseDateValue(listing.createdTime), current30dStart, now)) return sum;
      return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
    }, 0);

    const priorAcquisitionCost = nonEmptyListings.reduce((sum, listing) => {
      if (!isWithinWindow(parseDateValue(listing.createdTime), previous30dStart, current30dStart)) return sum;
      return sum + parseCurrencyAmount(listing.fields.Price ?? listing.fields['Purchase Price'] ?? listing.fields.Cost);
    }, 0);

    const avgAskPrice = activeProducts.length
      ? activeProducts.reduce((sum, product) => sum + (parseFloat(product.variants?.[0]?.price ?? '0') || 0), 0) / activeProducts.length
      : 0;

    const recentInventoryValue = activeProducts.reduce((sum, product) => {
      if (!isWithinWindow(parseDateValue(product.created_at), current30dStart, now)) return sum;
      const price = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
      const qty = product.variants?.[0]?.inventory_quantity ?? 1;
      return sum + price * Math.max(qty, 1);
    }, 0);

    const priorInventoryValue = activeProducts.reduce((sum, product) => {
      if (!isWithinWindow(parseDateValue(product.created_at), previous30dStart, current30dStart)) return sum;
      const price = parseFloat(product.variants?.[0]?.price ?? '0') || 0;
      const qty = product.variants?.[0]?.inventory_quantity ?? 1;
      return sum + price * Math.max(qty, 1);
    }, 0);

    const sellThroughPct = products.length ? Math.round((archivedProducts.length / products.length) * 100) : null;

    const recentArchivedProducts = archivedProducts.filter((product) => isWithinWindow(parseDateValue(product.updated_at), current30dStart, now));
    const priorArchivedProducts = archivedProducts.filter((product) => isWithinWindow(parseDateValue(product.updated_at), previous30dStart, current30dStart));

    const profitableItems = activeProducts.filter((product) => (parseFloat(product.variants?.[0]?.price ?? '0') || 0) > 0);
    const totalAsk = profitableItems.reduce((sum, product) => sum + (parseFloat(product.variants?.[0]?.price ?? '0') || 0), 0);

    const grossMarginPct = acquisitionCost > 0 && totalAsk > 0
      ? Math.round(((totalAsk - acquisitionCost) / totalAsk) * 100)
      : null;

    const recentAskValue = activeProducts.reduce((sum, product) => {
      if (!isWithinWindow(parseDateValue(product.created_at), current30dStart, now)) return sum;
      return sum + (parseFloat(product.variants?.[0]?.price ?? '0') || 0);
    }, 0);

    const priorAskValue = activeProducts.reduce((sum, product) => {
      if (!isWithinWindow(parseDateValue(product.created_at), previous30dStart, current30dStart)) return sum;
      return sum + (parseFloat(product.variants?.[0]?.price ?? '0') || 0);
    }, 0);

    const recentMarginPct = recentAcquisitionCost > 0 && recentAskValue > 0
      ? Math.round(((recentAskValue - recentAcquisitionCost) / recentAskValue) * 100)
      : 0;

    const priorMarginPct = priorAcquisitionCost > 0 && priorAskValue > 0
      ? Math.round(((priorAskValue - priorAcquisitionCost) / priorAskValue) * 100)
      : 0;

    const submissionsTrend = getTrendSummary(recentSubs.length, priorRecentSubs.length, '30d');
    const dealsTrend = getTrendSummary(recentDraftProducts.length, priorDraftProducts.length, '30d');
    const acquisitionTrend = getTrendSummary(recentAcquisitionCost, priorAcquisitionCost, '30d');
    const inventoryTrend = getTrendSummary(recentInventoryValue, priorInventoryValue, '30d');
    const salesTrend = getTrendSummary(recentArchivedProducts.length, priorArchivedProducts.length, '30d');
    const marginTrend = getTrendSummary(recentMarginPct, priorMarginPct, '30d');

    const submissionDays = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(now - (13 - i) * 24 * 60 * 60 * 1000);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const count = jfSubmissions.filter((submission) => {
        const submissionDate = new Date(submission.created_at);
        return submissionDate.toDateString() === date.toDateString();
      }).length;
      return { label, count };
    });

    const maxDayCount = Math.max(...submissionDays.map((day) => day.count), 1);

    const brandCounts: Record<string, number> = {};
    jfSubmissions.slice(0, 500).forEach((submission) => {
      const brandAnswer = Object.values(submission.answers).find((answer) => /brand/i.test(answer.text || '') || /brand/i.test(answer.name || ''));
      const brand = formatAnswer(brandAnswer?.answer)?.trim();
      if (brand && brand.length < 50) {
        brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      }
    });

    const topBrands = Object.entries(brandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const airtableInventoryValue = nonEmptyListings.reduce((sum, listing) => sum + parseCurrencyAmount(listing.fields.Price), 0);

    const uniqueAirtableBrands = new Set(
      nonEmptyListings
        .map((listing) => String(listing.fields.Brand ?? '').trim())
        .filter(Boolean),
    ).size;

    const uniqueAirtableTypes = new Set(
      nonEmptyListings
        .map((listing) => String(listing.fields['Component Type'] ?? '').trim())
        .filter(Boolean),
    ).size;

    const componentTypeCounts = nonEmptyListings.reduce<Record<string, number>>((acc, listing) => {
      const key = String(listing.fields['Component Type'] ?? 'Uncategorized').trim() || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const componentTypeSummary = Object.entries(componentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const airtableBrandCounts = nonEmptyListings.reduce<Record<string, number>>((acc, listing) => {
      const key = String(listing.fields.Brand ?? 'Unknown').trim() || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const airtableBrandSummary = Object.entries(airtableBrandCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const airtableDistributorSummary = Object.entries(
      nonEmptyListings.reduce<Record<string, { count: number; total: number }>>((acc, listing) => {
        const distributor = String(listing.fields.Distributor ?? 'Unknown').trim() || 'Unknown';
        const price = parseCurrencyAmount(listing.fields.Price);
        if (!acc[distributor]) {
          acc[distributor] = { count: 0, total: 0 };
        }
        acc[distributor].count += 1;
        acc[distributor].total += price;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);

    const airtableTypeTable = Object.entries(
      nonEmptyListings.reduce<Record<string, { count: number; total: number; brands: Set<string> }>>((acc, listing) => {
        const type = String(listing.fields['Component Type'] ?? 'Uncategorized').trim() || 'Uncategorized';
        const brand = String(listing.fields.Brand ?? '').trim();
        const price = parseCurrencyAmount(listing.fields.Price);
        if (!acc[type]) {
          acc[type] = { count: 0, total: 0, brands: new Set<string>() };
        }
        acc[type].count += 1;
        acc[type].total += price;
        if (brand) acc[type].brands.add(brand);
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([type, summary]) => ({
        type,
        count: summary.count,
        brandCount: summary.brands.size,
        averagePrice: summary.count ? summary.total / summary.count : 0,
        totalPrice: summary.total,
      }));

    const maxComponentTypeCount = Math.max(...componentTypeSummary.map(([, count]) => count), 1);
    const maxAirtableBrandCount = Math.max(...airtableBrandSummary.map(([, count]) => count), 1);

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
          targetTab: 'airtable',
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

    const severityOrder: Record<DashboardInsightSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      positive: 3,
    };

    const rankedInsights = insights
      .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
      .slice(0, 6);

    return {
      now,
      thisWeekSubs,
      recentSubs,
      draftProducts,
      activeProducts,
      archivedProducts,
      acquisitionCost,
      inventoryValue,
      avgAskPrice,
      sellThroughPct,
      grossMarginPct,
      submissionsTrend,
      dealsTrend,
      acquisitionTrend,
      inventoryTrend,
      salesTrend,
      marginTrend,
      submissionDays,
      maxDayCount,
      topBrands,
      airtableInventoryValue,
      uniqueAirtableBrands,
      uniqueAirtableTypes,
      componentTypeSummary,
      airtableBrandSummary,
      airtableDistributorSummary,
      airtableTypeTable,
      maxComponentTypeCount,
      maxAirtableBrandCount,
      insights: rankedInsights,
    };
  }, [jfSubmissions, nonEmptyListings, products]);
}
