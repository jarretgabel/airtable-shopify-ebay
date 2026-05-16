import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardActionsSection } from '@/components/dashboard/DashboardActionsSection';

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

describe('DashboardActionsSection', () => {
  it('shows unavailable action cards when runtime-gated features are degraded', () => {
    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'listings', 'ebay']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        ebayUnavailableReason="Missing public runtime config: VITE_EBAY_AUTH_HOST."
        shopifyApprovalUnavailableReason="Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF."
        onSelectTab={vi.fn()}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    expect(screen.getByText('Shopify review unavailable')).toBeInTheDocument();
    expect(screen.getByText('eBay unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();
  });

  it('routes eBay draft publishing work into combined listings', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'listings', 'ebay']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={true}
        ebayDraftCount={2}
        ebayPublishedCount={4}
        ebayTotal={9}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={onSelectTab}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2 eBay drafts to review/i }));

    expect(onSelectTab).toHaveBeenCalledWith('listings');
  });

  it('shows used-gear lifecycle action cards when stale and sold-ready work exists', () => {
    const onOpenInventoryPostPublishBucket = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'inventory']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={true}
        ebayDraftCount={0}
        ebayPublishedCount={4}
        ebayTotal={9}
        shopifyQueueApproved={1}
        shopifyQueuePending={0}
        shopifyQueueTotal={1}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={3}
        workflowStaleListingCount={2}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={1}
        workflowSoldReadyCount={1}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={1}
        workflowShippedCount={5}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={vi.fn()}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
      />,
    );

    expect(screen.getByText('1 sold ready to ship')).toBeInTheDocument();
    expect(screen.getByText('2 stale listings')).toBeInTheDocument();
    expect(screen.getByText('5 shipped history')).toBeInTheDocument();
    expect(screen.getByText('3 active listings')).toBeInTheDocument();
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1 sold ready to ship/i }));
    expect(onOpenInventoryPostPublishBucket).toHaveBeenCalledWith('sold-ready');
  });

  it('shows processor queue actions before generic post-publish work', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'inventory', 'parking-lot-1', 'listings']}
        currentUserRole="processor"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={onSelectTab}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    expect(screen.getByText('2 pending review')).toBeInTheDocument();
    expect(screen.getByText('2 processing blockers')).toBeInTheDocument();
    expect(screen.getByText('2 listing-phase rows')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /2 pending review/i }));
    fireEvent.click(screen.getByRole('button', { name: /2 processing blockers/i }));
    fireEvent.click(screen.getByRole('button', { name: /2 listing-phase rows/i }));

    expect(onSelectTab).toHaveBeenNthCalledWith(1, 'parking-lot-1');
    expect(onSelectTab).toHaveBeenNthCalledWith(2, 'inventory');
    expect(onSelectTab).toHaveBeenNthCalledWith(3, 'listings');
  });

  it('gives tester dashboards queue actions instead of an empty action rail', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'testing-queue', 'testing']}
        currentUserRole="tester"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={onSelectTab}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    expect(screen.getByText('4 in testing queue')).toBeInTheDocument();
    expect(screen.getByText('2 testing items aging')).toBeInTheDocument();
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4 in testing queue/i }));
    fireEvent.click(screen.getByRole('button', { name: /2 testing items aging/i }));

    expect(onSelectTab).toHaveBeenNthCalledWith(1, 'testing-queue');
    expect(onSelectTab).toHaveBeenNthCalledWith(2, 'testing-queue');
  });

  it('gives photographer dashboards queue-aging actions instead of record-form shortcuts', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'photography-queue']}
        currentUserRole="photographer"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={onSelectTab}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    expect(screen.getByText('4 waiting on photos')).toBeInTheDocument();
    expect(screen.getByText('2 photo items aging')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4 waiting on photos/i }));
    fireEvent.click(screen.getByRole('button', { name: /2 photo items aging/i }));

    expect(onSelectTab).toHaveBeenNthCalledWith(1, 'photography-queue');
    expect(onSelectTab).toHaveBeenNthCalledWith(2, 'photography-queue');
  });

  it('routes sold-ready and stale listing dashboard actions into post-publish buckets', () => {
    const onOpenInventoryPostPublishBucket = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'inventory']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides({
          ownership: {
            pendingReviewMineCount: 1,
            pendingReviewUnassignedCount: 1,
            progressMineCount: 0,
            progressUnassignedCount: 1,
          },
        })}
        workflowActiveListingCount={0}
        workflowStaleListingCount={2}
        workflowStaleListingMineCount={1}
        workflowStaleListingUnassignedCount={1}
        workflowSoldReadyCount={3}
        workflowSoldReadyMineCount={2}
        workflowSoldReadyUnassignedCount={1}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={vi.fn()}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /3 sold ready to ship/i }));
    expect(onOpenInventoryPostPublishBucket).toHaveBeenNthCalledWith(1, 'sold-ready');

    fireEvent.click(screen.getByRole('button', { name: /2 stale listings/i }));
    expect(onOpenInventoryPostPublishBucket).toHaveBeenNthCalledWith(2, 'stale-listing');
  });

  it('keeps the stale listing post-publish card when no ownership data is relevant', () => {
    const onOpenInventoryPostPublishBucket = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'inventory']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides()}
        workflowActiveListingCount={0}
        workflowStaleListingCount={1}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={1}
        workflowSoldReadyCount={1}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={1}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId={null}
        workflowPendingReviewOldestGroupLabel={null}
        workflowProgressOldestGroupId={null}
        workflowProgressOldestGroupLabel={null}
        onSelectTab={vi.fn()}
        onOpenInventoryWorkflowView={vi.fn()}
        onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /1 stale listing/i }));
    expect(onOpenInventoryPostPublishBucket).toHaveBeenCalledWith('stale-listing');
  });

  it('opens the oldest pending review and progress groups from dashboard actions', () => {
    const onOpenInventoryWorkflowView = vi.fn();

    render(
      <DashboardActionsSection
        accessiblePages={['dashboard', 'inventory']}
        currentUserRole="admin"
        currentUserName="Taylor Reviewer"
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowAnalytics={buildWorkflowAnalyticsOverrides({
          progressCount: 4,
          age: {
            pendingReviewAlertCount: 1,
            oldestPendingReviewAgeDays: 9,
            progressAlertCount: 2,
            oldestProgressAgeDays: 12,
            activeNearStaleCount: 0,
            staleFollowUpCount: 0,
            oldestListedAgeDays: null,
            oldestStaleAgeDays: null,
          },
        })}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingMineCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyMineCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        workflowPendingReviewOldestGroupId="pickup:pickup-100"
        workflowPendingReviewOldestGroupLabel="pickup-100"
        workflowProgressOldestGroupId="submission:submission-200"
        workflowProgressOldestGroupLabel="submission-200"
        onSelectTab={vi.fn()}
        onOpenInventoryWorkflowView={onOpenInventoryWorkflowView}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /9d oldest pending review/i }));
    expect(onOpenInventoryWorkflowView).toHaveBeenNthCalledWith(1, 'pending-review', { focusedGroupId: 'pickup:pickup-100' });

    fireEvent.click(screen.getByRole('button', { name: /12d oldest in progress/i }));
    expect(onOpenInventoryWorkflowView).toHaveBeenNthCalledWith(2, 'progress', { focusedGroupId: 'submission:submission-200' });
  });
});