import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardActionsSection } from '@/components/dashboard/DashboardActionsSection';

describe('DashboardActionsSection', () => {
  it('shows unavailable action cards when runtime-gated features are degraded', () => {
    render(
      <DashboardActionsSection
        ebayAuthenticated={false}
        ebayDraftCount={0}
        ebayPublishedCount={0}
        ebayTotal={0}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        ebayUnavailableReason="Missing public runtime config: VITE_EBAY_AUTH_HOST."
        shopifyApprovalUnavailableReason="Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF."
        onSelectTab={vi.fn()}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    expect(screen.getByText('Shopify listings review unavailable')).toBeInTheDocument();
    expect(screen.getByText('eBay snapshot unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();
  });

  it('routes eBay draft publishing work into combined listings', () => {
    const onSelectTab = vi.fn();

    render(
      <DashboardActionsSection
        ebayAuthenticated={true}
        ebayDraftCount={2}
        ebayPublishedCount={4}
        ebayTotal={9}
        shopifyQueueApproved={0}
        shopifyQueuePending={0}
        shopifyQueueTotal={0}
        workflowPostPublishLoading={false}
        workflowActiveListingCount={0}
        workflowStaleListingCount={0}
        workflowStaleListingUnassignedCount={0}
        workflowSoldReadyCount={0}
        workflowSoldReadyUnassignedCount={0}
        workflowShippedCount={0}
        onSelectTab={onSelectTab}
        onOpenInventoryPostPublishBucket={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /2 ebay drafts need listings review/i }));

    expect(onSelectTab).toHaveBeenCalledWith('listings');
  });

  it('shows used-gear lifecycle action cards when stale and sold-ready work exists', () => {
    const onOpenInventoryPostPublishBucket = vi.fn();

    render(
      <DashboardActionsSection
        ebayAuthenticated={true}
        ebayDraftCount={0}
        ebayPublishedCount={4}
        ebayTotal={9}
        shopifyQueueApproved={1}
        shopifyQueuePending={0}
        shopifyQueueTotal={1}
        workflowPostPublishLoading={false}
        workflowActiveListingCount={3}
        workflowStaleListingCount={2}
        workflowStaleListingUnassignedCount={1}
        workflowSoldReadyCount={1}
        workflowSoldReadyUnassignedCount={1}
        workflowShippedCount={5}
        onSelectTab={vi.fn()}
        onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
      />,
    );

    expect(screen.getByText('1 used-gear item sold and ready to ship')).toBeInTheDocument();
    expect(screen.getByText('2 used-gear listings stale')).toBeInTheDocument();
    expect(screen.getAllByText(/1 unassigned/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Opens Unassigned Sold Ready To Ship Bucket')).toBeInTheDocument();
    expect(screen.getByText('Opens Unassigned Stale Listings Bucket')).toBeInTheDocument();
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1 used-gear item sold and ready to ship/i }));
    expect(onOpenInventoryPostPublishBucket).toHaveBeenCalledWith('sold-ready', 'unassigned');
  });
});