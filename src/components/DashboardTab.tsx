import { useMemo, useState } from 'react';
import { canAccessCommerceDashboard, canAccessWorkflowDashboard, hasFullAccessRole } from '@/auth/roleAccess';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardOverviewSection, DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';
import { DashboardAirtableSection } from '@/components/dashboard/DashboardAirtableSection';
import { DashboardEbaySection } from '@/components/dashboard/DashboardEbaySection';
import { DashboardShopifySection } from '@/components/dashboard/DashboardShopifySection';
import { DashboardJotformSection } from '@/components/dashboard/DashboardJotformSection';
import { DashboardWorkflowAnalyticsSection } from '@/components/dashboard/DashboardWorkflowAnalyticsSection';
import { getDashboardDegradedSources, hasDashboardPartialData } from '@/components/dashboard/dashboardSourceHealth';
import { DashboardWorkflowSection } from '@/components/dashboard/DashboardWorkflowSections';
import { DashboardActionsSection } from '@/components/dashboard/DashboardActionsSection';
import { DashboardPartialDataNotice, DashboardSectionPanel } from '@/components/dashboard/dashboardPrimitives';
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

  const approvalUnavailableReason = useMemo(
    () => viewModel.status.sources.find((source) => source.key === 'listings-ebay')?.error ?? null,
    [viewModel.status.sources],
  );
  const shopifyApprovalUnavailableReason = useMemo(
    () => viewModel.status.sources.find((source) => source.key === 'listings-shopify')?.error ?? null,
    [viewModel.status.sources],
  );
  const ebayUnavailableReason = useMemo(
    () => viewModel.status.sources.find((source) => source.key === 'ebay')?.error ?? null,
    [viewModel.status.sources],
  );

  const ebayCards = useMemo(() => buildEbayWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    approvalApproved: workflow.approvalApproved,
    approvalError: workflow.approvalError,
    approvalUnavailableReason,
    approvalLoading: loading.approval,
    approvalPending: workflow.approvalPending,
    approvalTotal: workflow.approvalTotal,
    ebayAuthenticated: workflow.ebayAuthenticated,
    ebayDraftCount: workflow.ebayDraftCount,
    ebayError: workflow.ebayError,
    ebayUnavailableReason,
    ebayLoading: loading.ebay,
    ebayPublishedCount: workflow.ebayPublishedCount,
    ebayRestoringSession: workflow.ebayRestoringSession,
    ebayTotal: workflow.ebayTotal,
  }), [approvalUnavailableReason, ebayUnavailableReason, loading.approval, loading.ebay, workflow]);

  const shopifyCards = useMemo(() => buildShopifyWorkflowCards({
    accessiblePages: workflow.accessiblePages,
    shopifyLoading: loading.shopify,
    shopifyProductsCount: data.products.length,
    shopifyActiveCount: data.activeProducts.length,
    shopifyDraftCount: data.draftProducts.length,
    shopifyArchivedCount: data.archivedProducts.length,
    shopifyApprovalLoading: workflow.shopifyApprovalLoading,
    shopifyApprovalUnavailableReason,
    shopifyApprovalTotal: workflow.shopifyApprovalTotal,
    shopifyApprovalApproved: workflow.shopifyApprovalApproved,
    shopifyApprovalPending: workflow.shopifyApprovalPending,
  }), [
    data.activeProducts.length,
    data.archivedProducts.length,
    data.draftProducts.length,
    data.products.length,
    loading.shopify,
    shopifyApprovalUnavailableReason,
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
  const filteredInsights = useMemo(
    () => data.insights.filter((insight) => !insight.targetTab || workflow.accessiblePages.includes(insight.targetTab)),
    [data.insights, workflow.accessiblePages],
  );
  const showWorkflowDashboard = useMemo(() => canAccessWorkflowDashboard(workflow.accessiblePages), [workflow.accessiblePages]);
  const showCommerceDashboard = useMemo(() => canAccessCommerceDashboard(workflow.accessiblePages), [workflow.accessiblePages]);
  const showActionsSection = workflow.accessiblePages.includes('inventory') || workflow.accessiblePages.includes('listings') || workflow.accessiblePages.includes('ebay');
  const showOverviewSection = showWorkflowDashboard || showCommerceDashboard || filteredInsights.length > 0;
  const showExpandedSections = hasFullAccessRole(workflow.currentUserRole) || workflow.currentUserRole === 'developer';
  const [showDetailedSections, setShowDetailedSections] = useState(false);
  const degradedSources = useMemo(() => getDashboardDegradedSources(viewModel.status.sources), [viewModel.status.sources]);
  const showPartialDataNotice = useMemo(() => hasDashboardPartialData(viewModel.status.sources), [viewModel.status.sources]);

  const sections = useMemo(
    () => buildDashboardSections({ accessiblePages: workflow.accessiblePages, ebayCards, marketCards, utilityCards: allUtilityCards, showExpandedSections: showExpandedSections && showDetailedSections }),
    [allUtilityCards, ebayCards, marketCards, showDetailedSections, showExpandedSections, workflow.accessiblePages],
  );
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <div className="flex flex-col gap-12 pt-1 [overflow-anchor:none]">
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      {showPartialDataNotice && <DashboardPartialDataNotice degradedSources={degradedSources} />}
      {showOverviewSection ? (
        <DashboardSectionPanel id="overview" title="Overview">
          <DashboardOverviewSection
            accessiblePages={workflow.accessiblePages}
            canViewSensitiveMetrics={workflow.canViewSensitiveMetrics}
            currentUserRole={workflow.currentUserRole}
            workflowAnalytics={workflow.workflowAnalytics}
            spLoading={loading.shopify}
            draftCount={data.draftProducts.length}
            activeCount={data.activeProducts.length}
            archivedCount={data.archivedProducts.length}
            nonEmptyListingCount={data.nonEmptyListings.length}
            approvalPending={workflow.approvalPending}
            approvalApproved={workflow.approvalApproved}
            approvalTotal={workflow.approvalTotal}
            approvalUnavailableReason={approvalUnavailableReason}
            uniqueAirtableBrands={kpis.uniqueAirtableBrands}
            uniqueAirtableTypes={kpis.uniqueAirtableTypes}
            ebayPublishedCount={workflow.ebayPublishedCount}
            ebayDraftCount={workflow.ebayDraftCount}
            ebayTotal={workflow.ebayTotal}
            ebayUnavailableReason={ebayUnavailableReason}
            acquisitionCost={kpis.acquisitionCost}
            inventoryValue={kpis.inventoryValue}
            avgAskPrice={kpis.avgAskPrice}
            sellThroughPct={kpis.sellThroughPct}
            grossMarginPct={kpis.grossMarginPct}
            dealsTrend={kpis.dealsTrend}
            acquisitionTrend={kpis.acquisitionTrend}
            inventoryTrend={kpis.inventoryTrend}
            salesTrend={kpis.salesTrend}
            marginTrend={kpis.marginTrend}
            onSelectTab={actions.onSelectTab}
            embedded
          />
          {showActionsSection ? (
            <DashboardActionsSection
              accessiblePages={workflow.accessiblePages}
              currentUserRole={workflow.currentUserRole}
              currentUserName={workflow.currentUserName}
              ebayAuthenticated={workflow.ebayAuthenticated}
              ebayDraftCount={workflow.ebayDraftCount}
              ebayPublishedCount={workflow.ebayPublishedCount}
              ebayTotal={workflow.ebayTotal}
              shopifyQueueApproved={workflow.shopifyApprovalApproved}
              shopifyQueuePending={workflow.shopifyApprovalPending}
              shopifyQueueTotal={workflow.shopifyApprovalTotal}
              workflowPostPublishLoading={workflow.workflowPostPublishLoading}
              workflowAnalytics={workflow.workflowAnalytics}
              workflowActiveListingCount={workflow.workflowActiveListingCount}
              workflowStaleListingCount={workflow.workflowStaleListingCount}
              workflowStaleListingMineCount={workflow.workflowStaleListingMineCount}
              workflowStaleListingUnassignedCount={workflow.workflowStaleListingUnassignedCount}
              workflowSoldReadyCount={workflow.workflowSoldReadyCount}
              workflowSoldReadyMineCount={workflow.workflowSoldReadyMineCount}
              workflowSoldReadyUnassignedCount={workflow.workflowSoldReadyUnassignedCount}
              workflowShippedCount={workflow.workflowShippedCount}
              workflowPendingReviewOldestGroupId={workflow.workflowDashboardTargets.pendingReviewOldestGroup.id}
              workflowPendingReviewOldestGroupLabel={workflow.workflowDashboardTargets.pendingReviewOldestGroup.label}
              workflowProgressOldestGroupId={workflow.workflowDashboardTargets.progressOldestGroup.id}
              workflowProgressOldestGroupLabel={workflow.workflowDashboardTargets.progressOldestGroup.label}
              ebayUnavailableReason={viewModel.status.sources.find((source) => source.key === 'ebay')?.error ?? null}
              shopifyApprovalUnavailableReason={viewModel.status.sources.find((source) => source.key === 'listings-shopify')?.error ?? null}
              onSelectTab={actions.onSelectTab}
              onOpenInventoryWorkflowView={actions.onOpenInventoryWorkflowView}
              onOpenInventoryPostPublishBucket={actions.onOpenInventoryPostPublishBucket}
              embedded
            />
          ) : null}
          {showWorkflowDashboard ? (
            <DashboardWorkflowAnalyticsSection
              loading={workflow.workflowAnalytics.loading}
              error={workflow.workflowAnalytics.error}
              snapshot={workflow.workflowAnalytics}
              staleListingUnassignedCount={workflow.workflowStaleListingUnassignedCount}
              soldReadyUnassignedCount={workflow.workflowSoldReadyUnassignedCount}
              embedded
            />
          ) : null}
          {filteredInsights.length > 0 ? (
            <DashboardInsightsSection
              insights={filteredInsights}
              onSelectTab={actions.onSelectTab}
              onOpenInventoryPostPublishBucket={actions.onOpenInventoryPostPublishBucket}
              embedded
            />
          ) : null}
          {showExpandedSections ? (
            <div className="rounded-[14px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_88%,transparent)] px-4 py-4 text-[var(--ink)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Detailed Dashboards</p>
                  <p className="m-0 mt-1 text-[0.9rem] leading-[1.55] text-[var(--muted)]">
                    Keep the default view focused on the headline metrics. Open the detailed inventory, JotForm, Shopify, eBay, and utilities sections only when you need deeper analysis.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-[0.78rem] font-semibold text-[var(--ink)] transition hover:border-white/20 hover:bg-white/10"
                  onClick={() => setShowDetailedSections((current) => !current)}
                >
                  {showDetailedSections ? 'Hide detailed sections' : 'Show detailed sections'}
                </button>
              </div>
            </div>
          ) : null}
        </DashboardSectionPanel>
      ) : null}
      {showExpandedSections && showDetailedSections && workflow.accessiblePages.includes('inventory') ? (
      <DashboardAirtableSection
        atLoading={loading.airtable}
        errorMessage={viewModel.status.sources.find((source) => source.key === 'airtable')?.error ?? null}
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
      ) : null}
      {showExpandedSections && showDetailedSections && workflow.accessiblePages.includes('jotform') ? (
      <DashboardJotformSection
        jfLoading={loading.jotform}
        errorMessage={viewModel.status.sources.find((source) => source.key === 'jotform')?.error ?? null}
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
      ) : null}
      {showExpandedSections && showDetailedSections && (workflow.accessiblePages.includes('shopify') || workflow.accessiblePages.includes('listings')) ? (
      <DashboardShopifySection
        shopifyCards={shopifyCards}
        onSelectTab={actions.onSelectTab}
        spLoading={loading.shopify}
        errorMessage={viewModel.status.sources.find((source) => source.key === 'shopify')?.error ?? null}
        productsCount={data.products.length}
        activeProductsCount={data.activeProducts.length}
        draftProductsCount={data.draftProducts.length}
        archivedProductsCount={data.archivedProducts.length}
      />
      ) : null}
      {showExpandedSections && showDetailedSections && ebayCards.length > 0 ? (
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
      ) : null}
      {showExpandedSections && showDetailedSections && allUtilityCards.length > 0 ? <DashboardWorkflowSection sectionId="utility-workflows" title="Utilities" cards={allUtilityCards} onSelect={actions.onSelectTab} /> : null}
    </div>
  );
}
