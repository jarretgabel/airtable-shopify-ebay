import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingApprovalWorkflowSummary, type ListingApprovalWorkflowSummaryData } from '@/components/approval/ListingApprovalWorkflowSummary';

function buildSummary(): ListingApprovalWorkflowSummaryData {
  return {
    workflowStatus: 'Approved for Publish',
    workflowNextTeam: 'Listing',
    resolvedPrice: '2499.00',
    preListingReviewedBy: 'Lana Listing',
    timeline: [
      { id: 'accepted', label: 'Intake Accepted', status: 'completed', timestamp: '2026-05-02T05:00:00.000Z', actor: 'Paula Purchasing' },
      { id: 'processing', label: 'Processing Completed', status: 'completed', timestamp: '2026-05-02T06:00:00.000Z', actor: 'Iris Intake' },
      { id: 'testing', label: 'Testing Signed', status: 'completed', timestamp: '2026-05-02T07:00:00.000Z', actor: 'Tina Testing' },
      { id: 'photography', label: 'Photography Signed', status: 'completed', timestamp: '2026-05-02T08:00:00.000Z', actor: 'Perry Photos' },
      { id: 'pre-listing', label: 'Listing Review', status: 'completed', timestamp: '2026-05-02T08:30:00.000Z', actor: 'Lana Listing' },
      { id: 'approved', label: 'Approved For Publish', status: 'completed', timestamp: '2026-05-02T09:00:00.000Z', actor: 'Lana Listing' },
      { id: 'listed', label: 'Listed', status: 'pending', timestamp: null, actor: null },
      { id: 'sold-ready', label: 'Sold Ready To Ship', status: 'pending', timestamp: null, actor: null },
      { id: 'shipped', label: 'Shipped', status: 'pending', timestamp: null, actor: null },
    ],
  };
}

describe('ListingApprovalWorkflowSummary popup action', () => {
  it('renders an action button in the active milestone popup and fires the handler', () => {
    const onActiveAction = vi.fn();

    render(
      <ListingApprovalWorkflowSummary
        summary={buildSummary()}
        timelineOnly
        activeActionLabel="Go to Publish Actions"
        onActiveAction={onActiveAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to Publish Actions' }));

    expect(onActiveAction).toHaveBeenCalledTimes(1);
  });
});