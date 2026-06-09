import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';

const baseProps = {
  approvalChannel: 'combined' as const,
  isCombinedApproval: true,
  workflowStatus: 'Approved for Publish',
  saving: false,
  approving: false,
  pushingTarget: null,
  hasUnsavedChanges: false,
  canUpdateApprovedShopifyListing: false,
  isApproved: false,
  hasExistingShopifyRestProductId: false,
  hasMissingShopifyRequiredFields: false,
  hasMissingEbayRequiredFields: false,
  pushShopifyDisabled: false,
  pushEbayDisabled: false,
  pushBothDisabled: false,
  isShopifyPublishBlockedByAuctionFormat: false,
  onResetData: vi.fn(),
  onSaveUpdates: vi.fn(),
  onPublishShopify: vi.fn(),
  onPublishEbay: vi.fn(),
  onPublishBoth: vi.fn(),
  onPrimaryAction: vi.fn(),
  accentActionButtonClass: 'accent',
  secondaryActionButtonClass: 'secondary',
};

describe('ListingApprovalRecordActions', () => {
  it('shows approve-for-publish instead of publish buttons during listing review', () => {
    const onPrimaryAction = vi.fn();

    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Awaiting Pre-Listing Review"
        onPrimaryAction={onPrimaryAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve for Publish' }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Publish Shopify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish eBay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Both' })).not.toBeInTheDocument();
  });

  it('keeps publish buttons once the operational row is approved for publish', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Approved for Publish"
      />,
    );

    expect(screen.getByRole('button', { name: 'Publish Shopify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish eBay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Both' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve for Publish' })).not.toBeInTheDocument();
  });

  it('shows buy-it-now guidance when auction format blocks Shopify-related publish actions', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Approved for Publish"
        isShopifyPublishBlockedByAuctionFormat
        pushShopifyDisabled
        pushBothDisabled
      />,
    );

    const buyItNowButtons = screen.getAllByRole('button', { name: 'Set Buy It Now Format' });
    expect(buyItNowButtons).toHaveLength(2);
    expect(buyItNowButtons.every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});