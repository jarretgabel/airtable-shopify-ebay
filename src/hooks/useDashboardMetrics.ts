import { useMemo } from 'react';
import { AirtableRecord } from '@/types/airtable';
import { JotFormSubmission } from '@/types/jotform';
import { buildDashboardInsights } from '@/hooks/dashboard/insights';
import { getTrendSummary } from '@/hooks/dashboard/metricUtils';
import {
  computeAirtableDistributionMetrics,
  computeSubmissionMetrics,
  computeValueMetrics,
  createMetricWindows,
  sliceProducts,
} from '@/hooks/dashboard/dashboardMetricComputations';
import type { DashboardMetrics, ShopifyProductFull } from '@/hooks/dashboard/metricsTypes';

export type {
  DashboardInsight,
  DashboardInsightSeverity,
  DashboardInsightTargetTab,
} from '@/hooks/dashboard/metricsTypes';

export function useDashboardMetrics(nonEmptyListings: AirtableRecord[], products: ShopifyProductFull[], jfSubmissions: JotFormSubmission[]): DashboardMetrics {
  return useMemo(() => {
    const now = Date.now();
    const windows = createMetricWindows(now);
    const submissions = computeSubmissionMetrics(jfSubmissions, windows);
    const slices = sliceProducts(products, windows);
    const values = computeValueMetrics(nonEmptyListings, products, slices, windows);
    const airtable = computeAirtableDistributionMetrics(nonEmptyListings);

    const submissionsTrend = getTrendSummary(submissions.recentSubs.length, submissions.priorRecentSubs.length, '30d');
    const dealsTrend = getTrendSummary(slices.recentDraftProducts.length, slices.priorDraftProducts.length, '30d');
    const acquisitionTrend = getTrendSummary(values.recentAcquisitionCost, values.priorAcquisitionCost, '30d');
    const inventoryTrend = getTrendSummary(values.recentInventoryValue, values.priorInventoryValue, '30d');
    const salesTrend = getTrendSummary(slices.recentArchivedProducts.length, slices.priorArchivedProducts.length, '30d');
    const marginTrend = getTrendSummary(values.recentMarginPct, values.priorMarginPct, '30d');

    const insights = buildDashboardInsights({
      jfSubmissions,
      recentSubs: submissions.recentSubs,
      priorRecentSubs: submissions.priorRecentSubs,
      draftProducts: slices.draftProducts,
      activeProducts: slices.activeProducts,
      recentArchivedProducts: slices.recentArchivedProducts,
      priorArchivedProducts: slices.priorArchivedProducts,
      airtableBrandSummary: airtable.airtableBrandSummary,
      nonEmptyListings,
      now,
    });

    return {
      now,
      thisWeekSubs: submissions.thisWeekSubs,
      recentSubs: submissions.recentSubs,
      draftProducts: slices.draftProducts,
      activeProducts: slices.activeProducts,
      archivedProducts: slices.archivedProducts,
      acquisitionCost: values.acquisitionCost,
      inventoryValue: values.inventoryValue,
      avgAskPrice: values.avgAskPrice,
      sellThroughPct: values.sellThroughPct,
      grossMarginPct: values.grossMarginPct,
      submissionsTrend,
      dealsTrend,
      acquisitionTrend,
      inventoryTrend,
      salesTrend,
      marginTrend,
      submissionDays: submissions.submissionDays,
      maxDayCount: submissions.maxDayCount,
      topBrands: submissions.topBrands,
      airtableInventoryValue: values.airtableInventoryValue,
      uniqueAirtableBrands: airtable.uniqueAirtableBrands,
      uniqueAirtableTypes: airtable.uniqueAirtableTypes,
      componentTypeSummary: airtable.componentTypeSummary,
      airtableBrandSummary: airtable.airtableBrandSummary,
      airtableDistributorSummary: airtable.airtableDistributorSummary,
      airtableTypeTable: airtable.airtableTypeTable,
      maxComponentTypeCount: airtable.maxComponentTypeCount,
      maxAirtableBrandCount: airtable.maxAirtableBrandCount,
      insights,
    };
  }, [jfSubmissions, nonEmptyListings, products]);
}
