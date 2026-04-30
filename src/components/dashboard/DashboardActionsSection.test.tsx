import { render, screen } from '@testing-library/react';
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
        ebayUnavailableReason="Missing public runtime config: VITE_EBAY_AUTH_HOST."
        shopifyApprovalUnavailableReason="Missing public runtime config: VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF."
        onSelectTab={vi.fn()}
      />,
    );

    expect(screen.getByText('Shopify approval queue unavailable')).toBeInTheDocument();
    expect(screen.getByText('eBay publishing unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.queryByText('All clear — no actions required right now.')).not.toBeInTheDocument();
  });
});