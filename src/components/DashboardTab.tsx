import { useMemo } from 'react';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardOverviewSection, DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';
import { DashboardAirtableSection } from '@/components/dashboard/DashboardAirtableSection';
import { DashboardEbaySection } from '@/components/dashboard/DashboardEbaySection';
import { DashboardShopifySection } from '@/components/dashboard/DashboardShopifySection';
import { DashboardJotformSection } from '@/components/dashboard/DashboardJotformSection';
import { DashboardWorkflowSection } from '@/components/dashboard/DashboardWorkflowSections';
import { DashboardActionsSection } from '@/components/dashboard/DashboardActionsSection';
import { DashboardSectionPanel } from '@/components/dashboard/dashboardPrimitives';
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
    shopifyApprovalLoading: workflow.shopifyApprovalLoading,
    shopifyApprovalTotal: workflow.shopifyApprovalTotal,
    shopifyApprovalApproved: workflow.shopifyApprovalApproved,
    shopifyApprovalPending: workflow.shopifyApprovalPending,
  }), [
    data.activeProducts.length,
    data.archivedProducts.length,
    data.draftProducts.length,
    data.products.length,
    loading.shopify,
    workflow.accessiblePages,
    workflow.shopifyApprovalLoading,
    workflow.shopifyApprovalTotal,
    workflow.shopifyApprovalApproved,
    workflow.shopifyApprovalPending,
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
    aiProvider: workflow.aiProvider,
  }), [workflow]);

  const allUtilityCards = useMemo(() => [...marketCards, ...utilityCards], [marketCards, utilityCards]);

  const sections = useMemo(() => buildDashboardSections({ ebayCards, marketCards, utilityCards: allUtilityCards }), [ebayCards, marketCards, allUtilityCards]);
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <div className="flex flex-col gap-12 pt-1">
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      <DashboardSectionPanel id="overview" title="Overview">
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
          nonEmptyListingCount={data.nonEmptyListings.length}
          approvalPending={workflow.approvalPending}
          approvalApproved={workflow.approvalApproved}
          approvalTotal={workflow.approvalTotal}
          uniqueAirtableBrands={kpis.uniqueAirtableBrands}
          uniqueAirtableTypes={kpis.uniqueAirtableTypes}
          ebayPublishedCount={workflow.ebayPublishedCount}
          ebayDraftCount={workflow.ebayDraftCount}
          ebayTotal={workflow.ebayTotal}
          sellThroughPct={kpis.sellThroughPct}
          submissionsTrend={kpis.submissionsTrend}
          dealsTrend={kpis.dealsTrend}
          acquisitionTrend={kpis.acquisitionTrend}
          inventoryTrend={kpis.inventoryTrend}
          salesTrend={kpis.salesTrend}
          marginTrend={kpis.marginTrend}
          onSelectTab={actions.onSelectTab}
          embedded
        />
        <DashboardActionsSection
          ebayAuthenticated={workflow.ebayAuthenticated}
          ebayDraftCount={workflow.ebayDraftCount}
          ebayPublishedCount={workflow.ebayPublishedCount}
          ebayTotal={workflow.ebayTotal}
          shopifyQueueApproved={workflow.shopifyApprovalApproved}
          shopifyQueuePending={workflow.shopifyApprovalPending}
          shopifyQueueTotal={workflow.shopifyApprovalTotal}
          onSelectTab={actions.onSelectTab}
          embedded
        />
        <DashboardInsightsSection insights={data.insights} onSelectTab={actions.onSelectTab} embedded />
      </DashboardSectionPanel>
      <DashboardAirtableSection
        atLoading={loading.airtable}
        nonEmptyListingCount={data.nonEmptyListings.length}
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
      <DashboardShopifySection
        shopifyCards={shopifyCards}
        onSelectTab={actions.onSelectTab}
        spLoading={loading.shopify}
        productsCount={data.products.length}
        activeProductsCount={data.activeProducts.length}
        draftProductsCount={data.draftProducts.length}
        archivedProductsCount={data.archivedProducts.length}
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
      <DashboardWorkflowSection sectionId="utility-workflows" title="Utilities" cards={allUtilityCards} onSelect={actions.onSelectTab} />
    </div>
  );
}
