import { useCallback, useMemo, useState } from 'react';
import { canAccessCommerceDashboard, canAccessWorkflowDashboard, canViewFinance, hasFullAccessRole, isDeveloperRole } from '@/auth/roleAccess';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { SectionPillNav } from '@/components/app/SectionPillNav';
import { DashboardSectionNav } from '@/components/dashboard/DashboardSectionNav';
import { DashboardBuyersSection } from '@/components/dashboard/DashboardBuyersSection';
import { DashboardFinanceSection } from '@/components/dashboard/DashboardFinanceSection';
import { DashboardOverviewSection, DashboardInsightsSection } from '@/components/dashboard/DashboardOverviewInsightsSection';
import { getDashboardDegradedSources, hasDashboardPartialData } from '@/components/dashboard/dashboardSourceHealth';
import { DashboardCustomersSection } from '@/components/dashboard/DashboardCustomersSection';
import { DashboardReportsSection } from '@/components/dashboard/DashboardReportsSection';
import { DashboardSellersSection } from '@/components/dashboard/DashboardSellersSection';
import { DashboardActionsSection } from '@/components/dashboard/DashboardActionsSection';
import { DashboardPartialDataNotice, DashboardSectionPanel } from '@/components/dashboard/dashboardPrimitives';
import {
  buildDashboardSections,
  resolveDashboardView,
  type DashboardView,
} from '@/components/dashboard/dashboardTabHelpers';
import type { DashboardTabViewModel } from '@/app/appTabViewModels';
import { useDashboardSectionTracking } from '@/components/dashboard/useDashboardSectionTracking';

interface DashboardTabProps {
  viewModel: DashboardTabViewModel;
}

export function DashboardTab({ viewModel }: DashboardTabProps) {
  const {
    data,
    workflow,
    actions,
  } = viewModel;
  const isDeveloper = isDeveloperRole(workflow.currentUserRole);
  const workflowAnalyticsUnavailable = Boolean(workflow.workflowAnalytics.error);
  const filteredInsights = useMemo(
    () => data.insights.filter((insight) => !insight.targetTab || workflow.accessiblePages.includes(insight.targetTab)),
    [data.insights, workflow.accessiblePages],
  );
  const showWorkflowDashboard = useMemo(() => canAccessWorkflowDashboard(workflow.accessiblePages), [workflow.accessiblePages]);
  const showCommerceDashboard = useMemo(() => canAccessCommerceDashboard(workflow.accessiblePages), [workflow.accessiblePages]);
  const showActionsSection =
    (workflow.accessiblePages.includes('inventory') || workflow.accessiblePages.includes('listings') || workflow.accessiblePages.includes('ebay'))
    && (isDeveloper || !workflowAnalyticsUnavailable);
  const showInsightsSection = filteredInsights.length > 0;
  const showOverviewSection = (showWorkflowDashboard || showCommerceDashboard || filteredInsights.length > 0)
    && (isDeveloper || !workflowAnalyticsUnavailable);
  const degradedSources = useMemo(() => getDashboardDegradedSources(viewModel.status.sources), [viewModel.status.sources]);
  const showPartialDataNotice = useMemo(
    () => isDeveloper && hasDashboardPartialData(viewModel.status.sources),
    [isDeveloper, viewModel.status.sources],
  );
  const sourceStatusMap = useMemo(
    () => new Map(viewModel.status.sources.map((source) => [source.key, source])),
    [viewModel.status.sources],
  );
  const ebaySource = sourceStatusMap.get('ebay');
  const shopifyApprovalSource = sourceStatusMap.get('listings-shopify');
  const ebayDataMissing = Boolean(ebaySource?.error) && !ebaySource?.hasData;
  const shopifyApprovalDataMissing = Boolean(shopifyApprovalSource?.error) && !shopifyApprovalSource?.hasData;

  const fullAccess = hasFullAccessRole(workflow.currentUserRole);
  const financeAccess = canViewFinance(workflow.currentUserRole);
  const availableViews = useMemo<DashboardView[]>(
    () => ['overview', ...(financeAccess ? (['sales'] as const) : []), ...(fullAccess ? (['people'] as const) : [])],
    [financeAccess, fullAccess],
  );
  const [requestedView, setRequestedView] = useState<string | null>(() => new URLSearchParams(window.location.search).get('tab'));
  const view = resolveDashboardView(requestedView, availableViews);
  const selectView = useCallback((next: DashboardView) => {
    setRequestedView(next);
    const url = new URL(window.location.href);
    if (next === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const sections = useMemo(
    () => buildDashboardSections({
      includeOverview: view === 'overview',
      showActionsSection: view === 'overview' && showActionsSection,
      showInsightsSection: view === 'overview' && showInsightsSection,
      showSellersSection: view === 'people' && fullAccess,
      showFinanceSection: view === 'sales' && financeAccess,
      showBuyersSection: view === 'sales' && financeAccess,
      showReportsSection: view === 'sales' && fullAccess,
      showCustomersSection: view === 'people' && fullAccess,
    }),
    [view, showActionsSection, showInsightsSection, fullAccess, financeAccess],
  );
  const { activeSectionId, scrollToSection } = useDashboardSectionTracking(sections);

  return (
    <AppPageLayout className="[overflow-anchor:none]">
      <WorkflowPageHeader eyebrow="Overview" title="Dashboard" />
      {availableViews.length > 1 ? (
        <SectionPillNav
          ariaLabel="Dashboard views"
          items={availableViews.map((key) => ({ key, label: key === 'overview' ? 'Overview' : key === 'sales' ? 'Sales' : 'People' }))}
          activeKey={view}
          onSelect={selectView}
        />
      ) : null}
      <DashboardSectionNav sections={sections} activeSectionId={activeSectionId} onSelectSection={scrollToSection} />
      {showPartialDataNotice && <DashboardPartialDataNotice degradedSources={degradedSources} />}
      {view === 'overview' && showOverviewSection ? (
        <DashboardSectionPanel id="overview" title="Overview">
          <DashboardOverviewSection
            accessiblePages={workflow.accessiblePages}
            currentUserRole={workflow.currentUserRole}
            workflowAnalytics={workflow.workflowAnalytics}
            onSelectTab={actions.onSelectTab}
            showWarnings={isDeveloper}
            embedded
          />
        </DashboardSectionPanel>
      ) : null}
      {view === 'overview' && showActionsSection ? (
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
          workflowPostPublishError={workflow.workflowPostPublishError}
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
          ebayUnavailableReason={isDeveloper && ebayDataMissing ? ebaySource?.error ?? null : null}
          shopifyApprovalUnavailableReason={isDeveloper && shopifyApprovalDataMissing ? shopifyApprovalSource?.error ?? null : null}
          onSelectTab={actions.onSelectTab}
          onOpenInventoryWorkflowView={actions.onOpenInventoryWorkflowView}
          onOpenInventoryPostPublishBucket={actions.onOpenInventoryPostPublishBucket}
        />
      ) : null}
      {view === 'overview' && showInsightsSection ? (
        <DashboardInsightsSection
          insights={filteredInsights}
          onSelectTab={actions.onSelectTab}
          onOpenInventoryPostPublishBucket={actions.onOpenInventoryPostPublishBucket}
        />
      ) : null}
      {view === 'people' && fullAccess ? <DashboardSellersSection showWarnings={isDeveloper} /> : null}
      {view === 'sales' && financeAccess ? <DashboardFinanceSection showWarnings={isDeveloper} /> : null}
      {view === 'sales' && financeAccess ? <DashboardBuyersSection showWarnings={isDeveloper} /> : null}
      {view === 'sales' && fullAccess ? <DashboardReportsSection showWarnings={isDeveloper} /> : null}
      {view === 'people' && fullAccess ? <DashboardCustomersSection showWarnings={isDeveloper} /> : null}
    </AppPageLayout>
  );
}
