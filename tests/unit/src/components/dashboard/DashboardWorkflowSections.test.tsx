import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardWorkflowCardGrid } from '@/components/dashboard/DashboardWorkflowSections';
import { DashboardWorkflowAnalyticsSection } from '@/components/dashboard/DashboardWorkflowAnalyticsSection';
import { createEmptyUsedGearWorkflowAnalyticsSnapshot } from '@/services/usedGearWorkflowAnalytics';

describe('DashboardWorkflowCardGrid', () => {
  it('marks unavailable workflow cards and blocks navigation for them', () => {
    const onSelect = vi.fn();

    render(
      <DashboardWorkflowCardGrid
        cards={[
          {
            id: 'ebay',
            title: 'eBay Publishing',
            eyebrow: 'Runtime config required',
            detail: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
            stats: ['OAuth setup'],
            unavailableReason: 'Missing public runtime config: VITE_EBAY_AUTH_HOST.',
          },
          {
            id: 'shopify',
            title: 'Shopify Listings',
            eyebrow: '12 listings tracked',
            detail: 'Manage Shopify product statuses.',
            stats: ['7 active', '3 draft'],
          },
        ]}
        onSelect={onSelect}
      />,
    );

    const unavailableButton = screen.getByRole('button', { name: /ebay publishing/i });
    const availableButton = screen.getByRole('button', { name: /shopify listings/i });

    expect(unavailableButton).toBeDisabled();
    expect(screen.getByText('eBay unavailable')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();

    fireEvent.click(unavailableButton);
    fireEvent.click(availableButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('shopify');
  });

  it('renders the used-gear workflow analytics snapshot', () => {
    const snapshot = createEmptyUsedGearWorkflowAnalyticsSnapshot();
    snapshot.totalCount = 12;
    snapshot.pendingReviewCount = 2;
    snapshot.progressCount = 5;
    snapshot.postPublishCount = 4;
    snapshot.trashCount = 1;
    snapshot.statusCounts['Approved for Publish'] = 2;
    snapshot.marketplace.shopifyLiveCount = 2;
    snapshot.marketplace.ebayStaleCount = 1;
    snapshot.age.pendingReviewAlertCount = 1;
    snapshot.lifecycle.averageDaysToSell = 18.5;
    snapshot.lifecycle.averageDaysToShip = 2;

    render(
      <DashboardWorkflowAnalyticsSection
        loading={false}
        error={null}
        snapshot={snapshot}
        staleListingUnassignedCount={2}
        soldReadyUnassignedCount={1}
      />, 
    );

    expect(screen.getByText('Used Gear Workflow Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Workflow Rows')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Approved For Publish')).toBeInTheDocument();
    expect(screen.getByText('Shopify Live')).toBeInTheDocument();
    expect(screen.getByText('eBay Stale')).toBeInTheDocument();
    expect(screen.getByText('Post-Publish Ops')).toBeInTheDocument();
    expect(screen.getByText('Avg Days To Sell')).toBeInTheDocument();
    expect(screen.getByText('18.5d')).toBeInTheDocument();
    expect(screen.getByText('Stale Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Sold Ready Unassigned')).toBeInTheDocument();
  });
});