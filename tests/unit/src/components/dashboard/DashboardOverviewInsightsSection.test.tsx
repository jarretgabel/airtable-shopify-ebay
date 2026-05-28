import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardOverviewSection } from '@/components/dashboard/DashboardOverviewInsightsSection';

const baseOverviewProps = {
  onSelectTab: vi.fn(),
};

function buildWorkflowAnalyticsOverrides(overrides: Record<string, unknown> = {}) {
  const baseStatusCounts = {
    'Pending Review': 2,
    'Unqualified': 0,
    'Accepted - Awaiting Arrival': 3,
    'Accepted - Arrived, Awaiting SKU': 1,
    'Accepted - Arrived, Awaiting Missing Item': 1,
    'Testing In Progress': 4,
    'Photography In Progress': 0,
    'Awaiting Pre-Listing Review': 2,
    'Approved for Publish': 0,
    'Listed, Shopify': 0,
    'Listed, eBay': 0,
    'Stale Listing, Shopify': 0,
    'Stale Listing, eBay': 0,
    'Sold - Ready to Ship': 0,
    'Shipped': 0,
  };
  const { statusCounts: overrideStatusCounts, ...otherOverrides } = overrides;

  return {
    loading: false,
    error: null,
    totalCount: 0,
    pendingReviewCount: 2,
    trashCount: 0,
    progressCount: 0,
    postPublishCount: 0,
    statusCounts: {
      ...baseStatusCounts,
      ...((overrideStatusCounts as Record<string, number> | undefined) ?? {}),
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
    ...otherOverrides,
  };
}

describe('DashboardOverviewSection', () => {
  it('renders degraded workflow cards as unavailable and blocks navigation', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'inventory', 'listings']}
        currentUserRole="admin"
        workflowAnalytics={buildWorkflowAnalyticsOverrides({ error: 'Workflow analytics unavailable.' })}
        onSelectTab={onSelectTab}
      />,
    );

    expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('button', { name: /inventory value/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /testing queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photography queue/i })).not.toBeInTheDocument();

    const blockerButton = screen.getByRole('button', { name: /processing blockers/i });
    const listingsButton = screen.getByRole('button', { name: /used gear listings/i });

    expect(blockerButton).toBeDisabled();
    expect(listingsButton).toBeDisabled();

    fireEvent.click(blockerButton);
    fireEvent.click(listingsButton);

    expect(onSelectTab).not.toHaveBeenCalled();
    expect(screen.getAllByText('Off').length).toBeGreaterThanOrEqual(2);
  });

  it('keeps leadership dashboards focused on processor and listing summaries', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'manual-intake', 'inventory', 'listings', 'testing-queue', 'photography-queue']}
        currentUserRole="owner"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        {...baseOverviewProps}
      />,
    );

    expect(screen.getByRole('button', { name: /processor ops/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processing blockers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /used gear listings/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /testing queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^bench aging/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photography queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photo bench aging/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inventory value/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acquisition cost/i })).not.toBeInTheDocument();
  });

  it('shows only tester-focused operational modules for tester dashboards', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'testing-queue', 'testing']}
        currentUserRole="tester"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        {...baseOverviewProps}
      />,
    );

    expect(screen.getByRole('button', { name: /testing queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^bench aging/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /used gear listings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /processor ops/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /processing blockers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photography queue/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /photo bench aging/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inventory value/i })).not.toBeInTheDocument();
  });

  it('shows queue and metric modules for photographer dashboards', () => {
    render(
      <DashboardOverviewSection
        accessiblePages={['dashboard', 'photography-queue', 'photos']}
        currentUserRole="photographer"
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        {...baseOverviewProps}
      />,
    );

    expect(screen.getByRole('button', { name: /photography queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /photo bench aging/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /testing queue/i })).not.toBeInTheDocument();
  });
});