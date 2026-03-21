import { useMemo } from 'react';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardOverviewSection, DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';
import { DashboardAirtableSection } from '@/components/dashboard/DashboardAirtableSection';
import { DashboardEbaySection } from '@/components/dashboard/DashboardEbaySection';
import { DashboardShopifySection } from '@/components/dashboard/DashboardShopifySection';
import { DashboardJotformSection } from '@/components/dashboard/DashboardJotformSection';
import { DashboardWorkflowSection } from '@/components/dashboard/DashboardWorkflowSections';
import { DashboardListingsModule } from '@/components/dashboard/DashboardListingsModule';
import {
  buildDashboardSections,
  buildDashboardSummaryMetrics,
  buildEbayWorkflowCards,
  buildShopifyWorkflowCards,
  buildMarketWorkflowCards,
  buildUtilityWorkflowCards,
} from '@/components/dashboard/dashboardTabHelpers';
import type { DashboardTabViewModel } from '@/app/appTabViewModels';
import { useDashboardSectionTracking } from '@/components/dashboard/useDashboardSectionTracking';

interface DashboardTabProps {
  viewModel: DashboardTabViewModel;
}

export function DashboardTab({ viewModel }: DashboardTabProps) {
  const {
    loading,
    data,
    kpis,
    workflow,
    actions,
  } = viewModel;

  const {
    totalAsk,
    submissionWindowTotal,
    submissionAverage,
    activeSubmissionDays,
    peakSubmissionDay,
    peakSubmissionShare,
    chartGuideValues,
  } = useMemo(
    () => buildDashboardSummaryMetrics(data.activeProducts, data.submissionDays, kpis.maxDayCount),
    [data.activeProducts, data.submissionDays, kpis.maxDayCount],
  );

  const ebayCards = useMemo(() => buildEbayWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    approvalApproved: workflow.approvalApproved,
    approvalError: workflow.approvalError,
    approvalLoading: loading.approval,
    approvalPending: workflow.approvalPending,
    approvalTotal: workflow.approvalTotal,
    ebayAuthenticated: workflow.ebayAuthenticated,
    ebayDraftCount: workflow.ebayDraftCount,
    ebayError: workflow.ebayError,
    ebayLoading: loading.ebay,
    ebayPublishedCount: workflow.ebayPublishedCount,
    ebayRestoringSession: workflow.ebayRestoringSession,
    ebayTotal: workflow.ebayTotal,
  }), [loading.approval, loading.ebay, workflow]);

  const shopifyCards = useMemo(() => buildShopifyWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    shopifyLoading: loading.shopify,
    shopifyProductsCount: data.products.length,
    shopifyActiveCount: data.activeProducts.length,
    shopifyDraftCount: data.draftProducts.length,
    shopifyArchivedCount: data.archivedProducts.length,
  }), [
    data.activeProducts.length,
    data.archivedProducts.length,
    data.draftProducts.length,
    data.products.length,
    loading.shopify,
    workflow.accessiblePages,
  ]);

  const marketCards = useMemo(() => buildMarketWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    marketCurrentSlug: workflow.marketCurrentSlug,
    marketError: workflow.marketError,
    marketListingCount: workflow.marketListingCount,
    marketLoading: loading.market,
  }), [loading.market, workflow]);

  const utilityCards = useMemo(() => buildUtilityWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    adminCount: workflow.adminCount,
    aiProvider: workflow.aiProvider,
    userCount: workflow.userCount,
  }), [workflow]);

  const sections = useMemo(() => buildDashboardSections({ ebayCards, marketCards, utilityCards }), [ebayCards, marketCards, utilityCards]);
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <div className="flex flex-col gap-12 pt-1">
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      <DashboardOverviewSection
        jfLoading={loading.jotform}
        jfSubmissionCount={data.jfSubmissions.length}
        thisWeekCount={data.thisWeekSubs.length}
        recentCount={data.recentSubs.length}
        totalNewSubmissions={kpis.totalNewSubmissions}
        spLoading={loading.shopify}
        draftCount={data.draftProducts.length}
        activeCount={data.activeProducts.length}
        archivedCount={data.archivedProducts.length}
        atLoading={loading.airtable}
        acquisitionCost={kpis.acquisitionCost}
        nonEmptyListingCount={data.nonEmptyListings.length}
        inventoryValue={kpis.inventoryValue}
        avgAskPrice={kpis.avgAskPrice}
        sellThroughPct={kpis.sellThroughPct}
        grossMarginPct={kpis.grossMarginPct}
        submissionsTrend={kpis.submissionsTrend}
        dealsTrend={kpis.dealsTrend}
        acquisitionTrend={kpis.acquisitionTrend}
        inventoryTrend={kpis.inventoryTrend}
        salesTrend={kpis.salesTrend}
        marginTrend={kpis.marginTrend}
        onSelectTab={actions.onSelectTab}
      />
      <DashboardListingsModule
        spLoading={loading.shopify}
        ebayLoading={loading.ebay}
        ebayAuthenticated={workflow.ebayAuthenticated}
        activeProductsCount={data.activeProducts.length}
        draftProductsCount={data.draftProducts.length}
        archivedProductsCount={data.archivedProducts.length}
        ebayPublishedCount={workflow.ebayPublishedCount}
        ebayDraftCount={workflow.ebayDraftCount}
        ebayTotal={workflow.ebayTotal}
        onSelectTab={actions.onSelectTab}
      />
      <DashboardInsightsSection insights={data.insights} onSelectTab={actions.onSelectTab} />
      <DashboardAirtableSection
        atLoading={loading.airtable}
        nonEmptyListingCount={data.nonEmptyListings.length}
        airtableInventoryValue={kpis.airtableInventoryValue}
        uniqueAirtableBrands={kpis.uniqueAirtableBrands}
        uniqueAirtableTypes={kpis.uniqueAirtableTypes}
        componentTypeSummary={data.componentTypeSummary}
        airtableBrandSummary={data.airtableBrandSummary}
        airtableDistributorSummary={data.airtableDistributorSummary}
        airtableTypeTable={data.airtableTypeTable}
        maxComponentTypeCount={kpis.maxComponentTypeCount}
        maxAirtableBrandCount={kpis.maxAirtableBrandCount}
        onSelectTab={actions.onSelectTab}
      />
      <DashboardShopifySection
        shopifyCards={shopifyCards}
        onSelectTab={actions.onSelectTab}
        spLoading={loading.shopify}
        productsCount={data.products.length}
        activeProductsCount={data.activeProducts.length}
        draftProductsCount={data.draftProducts.length}
        archivedProductsCount={data.archivedProducts.length}
        avgAskPrice={kpis.avgAskPrice}
        inventoryValue={kpis.inventoryValue}
        grossMarginPct={kpis.grossMarginPct}
        acquisitionCost={kpis.acquisitionCost}
        totalAsk={totalAsk}
      />
      <DashboardJotformSection
        jfLoading={loading.jotform}
        submissionWindowTotal={submissionWindowTotal}
        submissionAverage={submissionAverage}
        activeSubmissionDays={activeSubmissionDays}
        peakSubmissionDay={peakSubmissionDay}
        peakSubmissionShare={peakSubmissionShare}
        chartGuideValues={chartGuideValues}
        maxDayCount={kpis.maxDayCount}
        submissionDays={data.submissionDays}
        topBrands={data.topBrands}
        jfSubmissions={data.jfSubmissions}
        now={data.now}
        onSelectTab={actions.onSelectTab}
      />
      <DashboardEbaySection
        cards={ebayCards}
        onSelectTab={actions.onSelectTab}
        ebayLoading={loading.ebay}
        ebayAuthenticated={workflow.ebayAuthenticated}
        ebayRestoringSession={workflow.ebayRestoringSession}
        ebayError={workflow.ebayError}
        ebayTotal={workflow.ebayTotal}
        ebayPublishedCount={workflow.ebayPublishedCount}
        ebayDraftCount={workflow.ebayDraftCount}
      />
      <DashboardWorkflowSection sectionId="market-research" title="HiFi Shark" cards={marketCards} singleCardId="market" onSelect={actions.onSelectTab} />
      <DashboardWorkflowSection sectionId="utility-workflows" title="Utilities" cards={utilityCards} onSelect={actions.onSelectTab} />
    </div>
  );
}
