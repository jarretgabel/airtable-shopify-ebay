import { useMemo } from 'react';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardOverviewSection, DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';
import { DashboardAirtableSection } from '@/components/dashboard/DashboardAirtableSection';
import { DashboardShopifySection } from '@/components/dashboard/DashboardShopifySection';
import { DashboardJotformSection } from '@/components/dashboard/DashboardJotformSection';
import { DashboardWorkflowSection } from '@/components/dashboard/DashboardWorkflowSections';
import {
  buildDashboardSections,
  buildDashboardSummaryMetrics,
  buildEbayWorkflowCards,
  buildMarketWorkflowCards,
  buildUtilityWorkflowCards,
} from '@/components/dashboard/dashboardTabHelpers';
import type { DashboardTabProps } from '@/components/dashboard/dashboardTabTypes';
import { useDashboardSectionTracking } from '@/components/dashboard/useDashboardSectionTracking';

export function DashboardTab(props: DashboardTabProps) {
  const {
    atLoading,
    spLoading,
    jfLoading,
    nonEmptyListings,
    products,
    jfSubmissions,
    totalNewSubmissions,
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
    now,
    airtableInventoryValue,
    uniqueAirtableBrands,
    uniqueAirtableTypes,
    componentTypeSummary,
    airtableBrandSummary,
    airtableDistributorSummary,
    airtableTypeTable,
    maxComponentTypeCount,
    maxAirtableBrandCount,
    insights,
    accessiblePages,
    approvalLoading,
    approvalError,
    approvalTotal,
    approvalApproved,
    approvalPending,
    aiProvider,
    ebayAuthenticated,
    ebayRestoringSession,
    ebayLoading,
    ebayError,
    ebayTotal,
    ebayPublishedCount,
    ebayDraftCount,
    marketLoading,
    marketError,
    marketCurrentSlug,
    marketListingCount,
    userCount,
    adminCount,
    onSelectTab,
  } = props;

  const {
    totalAsk,
    submissionWindowTotal,
    submissionAverage,
    activeSubmissionDays,
    peakSubmissionDay,
    peakSubmissionShare,
    chartGuideValues,
  } = useMemo(
    () => buildDashboardSummaryMetrics(activeProducts, submissionDays, maxDayCount),
    [activeProducts, maxDayCount, submissionDays],
  );

  const ebayCards = useMemo(() => buildEbayWorkflowCards({
    accessiblePages,
    approvalApproved,
    approvalError,
    approvalLoading,
    approvalPending,
    approvalTotal,
    ebayAuthenticated,
    ebayDraftCount,
    ebayError,
    ebayLoading,
    ebayPublishedCount,
    ebayRestoringSession,
    ebayTotal,
  }), [accessiblePages, approvalApproved, approvalError, approvalLoading, approvalPending, approvalTotal, ebayAuthenticated, ebayDraftCount, ebayError, ebayLoading, ebayPublishedCount, ebayRestoringSession, ebayTotal]);

  const marketCards = useMemo(() => buildMarketWorkflowCards({
    accessiblePages,
    marketCurrentSlug,
    marketError,
    marketListingCount,
    marketLoading,
  }), [accessiblePages, marketCurrentSlug, marketError, marketListingCount, marketLoading]);

  const utilityCards = useMemo(() => buildUtilityWorkflowCards({
    accessiblePages,
    adminCount,
    aiProvider,
    userCount,
  }), [accessiblePages, adminCount, aiProvider, userCount]);

  const sections = useMemo(() => buildDashboardSections({ ebayCards, marketCards, utilityCards }), [ebayCards, marketCards, utilityCards]);
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <div className="flex flex-col gap-12 pt-1">
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      <DashboardOverviewSection
        jfLoading={jfLoading}
        jfSubmissionCount={jfSubmissions.length}
        thisWeekCount={thisWeekSubs.length}
        recentCount={recentSubs.length}
        totalNewSubmissions={totalNewSubmissions}
        spLoading={spLoading}
        draftCount={draftProducts.length}
        activeCount={activeProducts.length}
        archivedCount={archivedProducts.length}
        atLoading={atLoading}
        acquisitionCost={acquisitionCost}
        nonEmptyListingCount={nonEmptyListings.length}
        inventoryValue={inventoryValue}
        avgAskPrice={avgAskPrice}
        sellThroughPct={sellThroughPct}
        grossMarginPct={grossMarginPct}
        submissionsTrend={submissionsTrend}
        dealsTrend={dealsTrend}
        acquisitionTrend={acquisitionTrend}
        inventoryTrend={inventoryTrend}
        salesTrend={salesTrend}
        marginTrend={marginTrend}
        onSelectTab={onSelectTab}
      />
      <DashboardInsightsSection insights={insights} onSelectTab={onSelectTab} />
      <DashboardAirtableSection
        atLoading={atLoading}
        nonEmptyListingCount={nonEmptyListings.length}
        airtableInventoryValue={airtableInventoryValue}
        uniqueAirtableBrands={uniqueAirtableBrands}
        uniqueAirtableTypes={uniqueAirtableTypes}
        componentTypeSummary={componentTypeSummary}
        airtableBrandSummary={airtableBrandSummary}
        airtableDistributorSummary={airtableDistributorSummary}
        airtableTypeTable={airtableTypeTable}
        maxComponentTypeCount={maxComponentTypeCount}
        maxAirtableBrandCount={maxAirtableBrandCount}
        onSelectTab={onSelectTab}
      />
      <DashboardShopifySection
        jfLoading={jfLoading}
        spLoading={spLoading}
        submissionWindowTotal={submissionWindowTotal}
        submissionAverage={submissionAverage}
        activeSubmissionDays={activeSubmissionDays}
        peakSubmissionDay={peakSubmissionDay}
        peakSubmissionShare={peakSubmissionShare}
        chartGuideValues={chartGuideValues}
        maxDayCount={maxDayCount}
        submissionDays={submissionDays}
        productsCount={products.length}
        activeProductsCount={activeProducts.length}
        draftProductsCount={draftProducts.length}
        archivedProductsCount={archivedProducts.length}
        avgAskPrice={avgAskPrice}
        inventoryValue={inventoryValue}
        grossMarginPct={grossMarginPct}
        acquisitionCost={acquisitionCost}
        totalAsk={totalAsk}
      />
      <DashboardJotformSection jfLoading={jfLoading} topBrands={topBrands} jfSubmissions={jfSubmissions} now={now} onSelectTab={onSelectTab} />
      <DashboardWorkflowSection sectionId="ebay-workflows" title="eBay" cards={ebayCards} onSelect={onSelectTab} />
      <DashboardWorkflowSection sectionId="market-research" title="HiFi Shark" cards={marketCards} singleCardId="market" onSelect={onSelectTab} />
      <DashboardWorkflowSection sectionId="utility-workflows" title="Utilities" cards={utilityCards} onSelect={onSelectTab} />
    </div>
  );
}
