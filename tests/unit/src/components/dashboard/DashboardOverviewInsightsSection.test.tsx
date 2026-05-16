import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardOverviewSection } from '@/components/dashboard/DashboardOverviewInsightsSection';

function buildWorkflowAnalyticsOverrides(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    error: null,
    totalCount: 0,
    pendingReviewCount: 2,
    trashCount: 0,
    progressCount: 0,
    postPublishCount: 0,
    statusCounts: {
      'Pending Review': 2,
      'Unqualified': 0,
      'Accepted - Awaiting Arrival': 3,
      'Accepted - Arrived, Awaiting SKU': 1,
      'Accepted - Arrived, Awaiting Missing Item': 1,
      'Testing and Photography In Progress': 4,
      'Awaiting Pre-Listing Review': 2,
      'Approved for Publish': 0,
      'Listed, Shopify': 0,
      'Listed, eBay': 0,
      'Stale Listing, Shopify': 0,
      'Stale Listing, eBay': 0,
      'Sold - Ready to Ship': 0,
      'Shipped': 0,
    },
    marketplace: {
      shopifyLiveCount: 0,
      shopifyStaleCount: 0,
      ebayLiveCount: 0,
      ebayStaleCount: 0,
      soldReadyCount: 0,
      shippedCount: 0,
    },
    ownership: {
      pendingReviewMineCount: 0,
      pendingReviewUnassignedCount: 0,
      progressMineCount: 0,
      progressUnassignedCount: 0,
    },
    age: {
      pendingReviewAlertCount: 0,
      oldestPendingReviewAgeDays: null,
      progressAlertCount: 2,
      oldestProgressAgeDays: null,
      activeNearStaleCount: 0,
      staleFollowUpCount: 0,
      oldestListedAgeDays: null,
      oldestStaleAgeDays: null,
    },
    lifecycle: {
      averageDaysToSell: null,
      averageDaysToShip: null,
      soldReadyAwaitingShipmentCount: 0,
      oldestSoldReadyAgeDays: null,
    },
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('DashboardOverviewSection', () => {
  it('renders degraded KPI cards as unavailable and blocks navigation', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'inventory', 'listings', 'shopify', 'jotform', 'ebay']}
        canViewSensitiveMetrics={false}
        currentUserRole="admin"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        spLoading={false}
        draftCount={3}
        activeCount={7}
        archivedCount={1}
        nonEmptyListingCount={12}
        approvalPending={6}
        approvalApproved={10}
        approvalTotal={16}
        approvalUnavailableReason="Missing public runtime config: VITE_AIRTABLE_APPROVAL_TABLE_REF."
        uniqueAirtableBrands={5}
        uniqueAirtableTypes={4}
        ebayPublishedCount={8}
        ebayDraftCount={2}
        ebayTotal={10}
        ebayUnavailableReason="Missing public runtime config: VITE_EBAY_AUTH_HOST."
        acquisitionCost={12500}
        inventoryValue={44000}
        avgAskPrice={3400}
        sellThroughPct={30}
        grossMarginPct={42}
        dealsTrend={{ direction: 'flat', text: 'Flat' }}
        acquisitionTrend={{ direction: 'flat', text: 'Flat' }}
        inventoryTrend={{ direction: 'flat', text: 'Flat' }}
        salesTrend={{ direction: 'flat', text: 'Flat' }}
        marginTrend={{ direction: 'flat', text: 'Flat' }}
        onSelectTab={onSelectTab}
      />,
    );

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: /inventory value/i })).not.toBeInTheDocument();

    const approvalButton = screen.getByRole('button', { name: /listings review/i });
    const ebayButton = screen.getByRole('button', { name: /ebay coverage/i });
    const shopifyButton = screen.getByRole('button', { name: /shopify drafts/i });

    expect(approvalButton).toBeDisabled();
    expect(ebayButton).toBeDisabled();
    expect(shopifyButton).toBeEnabled();

    fireEvent.click(approvalButton);
    fireEvent.click(ebayButton);
    fireEvent.click(shopifyButton);

    expect(onSelectTab).toHaveBeenCalledTimes(1);
    expect(onSelectTab).toHaveBeenCalledWith('shopify');
    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(2);
  });

  it('renders owner-only financial cards when sensitive metrics are enabled', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'manual-intake', 'inventory', 'listings', 'shopify', 'jotform', 'ebay', 'testing-queue', 'testing', 'photography-queue', 'photos']}
        canViewSensitiveMetrics
        currentUserRole="owner"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        spLoading={false}
        draftCount={3}
        activeCount={7}
        archivedCount={1}
        nonEmptyListingCount={12}
        approvalPending={6}
        approvalApproved={10}
        approvalTotal={16}
        approvalUnavailableReason={null}
        uniqueAirtableBrands={5}
        uniqueAirtableTypes={4}
        ebayPublishedCount={8}
        ebayDraftCount={2}
        ebayTotal={10}
        ebayUnavailableReason={null}
        acquisitionCost={12500}
        inventoryValue={44000}
        avgAskPrice={3400}
        sellThroughPct={30}
        grossMarginPct={42}
        dealsTrend={{ direction: 'flat', text: 'Flat' }}
        acquisitionTrend={{ direction: 'flat', text: 'Flat' }}
        inventoryTrend={{ direction: 'flat', text: 'Flat' }}
        salesTrend={{ direction: 'flat', text: 'Flat' }}
        marginTrend={{ direction: 'flat', text: 'Flat' }}
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /inventory value/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /acquisition cost/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processor ops/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processing blockers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /testing queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bench aging/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photography queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo handoffs/i })).toBeInTheDocument();
  });

  it('shows only tester-focused operational modules for tester dashboards', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'testing-queue', 'testing']}
        canViewSensitiveMetrics={false}
        currentUserRole="tester"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        spLoading={false}
        draftCount={0}
        activeCount={0}
        archivedCount={0}
        nonEmptyListingCount={0}
        approvalPending={0}
        approvalApproved={0}
        approvalTotal={0}
        approvalUnavailableReason={null}
        uniqueAirtableBrands={0}
        uniqueAirtableTypes={0}
        ebayPublishedCount={0}
        ebayDraftCount={0}
        ebayTotal={0}
        ebayUnavailableReason={null}
        acquisitionCost={0}
        inventoryValue={0}
        avgAskPrice={0}
        sellThroughPct={null}
        grossMarginPct={null}
        dealsTrend={{ direction: 'flat', text: 'Flat' }}
        acquisitionTrend={{ direction: 'flat', text: 'Flat' }}
        inventoryTrend={{ direction: 'flat', text: 'Flat' }}
        salesTrend={{ direction: 'flat', text: 'Flat' }}
        marginTrend={{ direction: 'flat', text: 'Flat' }}
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /testing queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bench aging/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /processor ops/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /processing blockers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photography queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photo handoffs/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inventory value/i })).not.toBeInTheDocument();
  });

  it('shows queue and metric modules for photographer dashboards', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'photography-queue', 'photos']}
        canViewSensitiveMetrics={false}
        currentUserRole="photographer"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        spLoading={false}
        draftCount={0}
        activeCount={0}
        archivedCount={0}
        nonEmptyListingCount={0}
        approvalPending={0}
        approvalApproved={0}
        approvalTotal={0}
        approvalUnavailableReason={null}
        uniqueAirtableBrands={0}
        uniqueAirtableTypes={0}
        ebayPublishedCount={0}
        ebayDraftCount={0}
        ebayTotal={0}
        ebayUnavailableReason={null}
        acquisitionCost={0}
        inventoryValue={0}
        avgAskPrice={0}
        sellThroughPct={null}
        grossMarginPct={null}
        dealsTrend={{ direction: 'flat', text: 'Flat' }}
        acquisitionTrend={{ direction: 'flat', text: 'Flat' }}
        inventoryTrend={{ direction: 'flat', text: 'Flat' }}
        salesTrend={{ direction: 'flat', text: 'Flat' }}
        marginTrend={{ direction: 'flat', text: 'Flat' }}
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /photography queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo handoffs/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /testing queue/i })).not.toBeInTheDocument();
  });
});