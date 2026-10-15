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
  hasExistingEbayOfferId: false,
  hasExistingShopifyRestProductId: false,
  hasMissingShopifyRequiredFields: false,
  hasMissingEbayRequiredFields: false,
  pushShopifyDisabled: false,
  pushEbayDisabled: false,
  pushBothDisabled: false,
  isShopifyPublishBlockedByAuctionFormat: false,
  shopifyAdminListingUrl: null,
  shopifyServiceListingUrl: null,
  ebayAdminListingUrl: null,
  ebayServiceListingUrl: null,
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
  it('places the stock-overwrite warning beside both eBay update actions', () => {
    render(<ListingApprovalRecordActions {...baseProps} workflowStatus="Listed, eBay" hasExistingEbayOfferId hasExistingShopifyRestProductId />);
    const warning = screen.getByRole('note', { name: 'eBay stock update warning' });
    expect(warning).toHaveTextContent('can replace live stock');
    expect(warning.parentElement).toBe(screen.getByRole('button', { name: 'Update eBay' }).parentElement);
    expect(warning.parentElement).toBe(screen.getByRole('button', { name: 'Update Both' }).parentElement);
  });

  it('retains the warning when a publish-labelled action can reuse an existing eBay offer', () => {
    render(<ListingApprovalRecordActions {...baseProps} hasExistingEbayOfferId />);
    expect(screen.getByRole('button', { name: 'Publish eBay' })).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'eBay stock update warning' })).toBeInTheDocument();
  });

  it.each([
    { hasExistingEbayOfferId: false },
    { approvalChannel: 'shopify', isCombinedApproval: false },
    { workflowStatus: 'Sold - Ready to Ship' },
    { workflowStatus: 'Shipped' },
    { hasMissingEbayRequiredFields: true },
    { hasMissingShopifyRequiredFields: true },
  ] as const)('hides the stock warning when there is no relevant eBay update action: %j', (overrides) => {
    render(<ListingApprovalRecordActions {...baseProps} hasExistingEbayOfferId {...overrides} />);
    expect(screen.queryByRole('note', { name: 'eBay stock update warning' })).not.toBeInTheDocument();
  });

  it('also warns beside the single-channel eBay action', () => {
    render(<ListingApprovalRecordActions {...baseProps} approvalChannel="ebay" isCombinedApproval={false} hasExistingEbayOfferId />);
    expect(screen.getByRole('note', { name: 'eBay stock update warning' })).toBeInTheDocument();
  });

  it('shows direct publish buttons during listing review', () => {
    const onPublishShopify = vi.fn();
    const onPublishEbay = vi.fn();
    const onPublishBoth = vi.fn();

    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Awaiting Pre-Listing Review"
        onPublishShopify={onPublishShopify}
        onPublishEbay={onPublishEbay}
        onPublishBoth={onPublishBoth}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Publish Shopify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish eBay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish Both' }));

    expect(onPublishShopify).toHaveBeenCalledTimes(1);
    expect(onPublishEbay).toHaveBeenCalledTimes(1);
    expect(onPublishBoth).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Approve for Publish' })).not.toBeInTheDocument();
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

  it('hides all publishing actions when Shopify-required data is missing', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        hasMissingShopifyRequiredFields
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publish Shopify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish eBay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Both' })).not.toBeInTheDocument();
  });

  it('hides all publishing actions when eBay-required data is missing', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        hasMissingEbayRequiredFields
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publish Shopify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish eBay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Both' })).not.toBeInTheDocument();
  });

  it('hides every publish action when both channels have missing required data', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        hasMissingShopifyRequiredFields
        hasMissingEbayRequiredFields
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publish Shopify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish eBay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Both' })).not.toBeInTheDocument();
  });

  it('keeps publish labels for approved rows even when stale marketplace IDs are present', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Approved for Publish"
        hasExistingShopifyRestProductId
        hasExistingEbayOfferId
      />,
    );

    expect(screen.getByRole('button', { name: 'Publish Shopify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish eBay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish Both' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update Shopify' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update eBay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update Both' })).not.toBeInTheDocument();
  });

  it('switches to update labels when existing marketplace IDs are present', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        workflowStatus="Listed, Shopify"
        hasExistingShopifyRestProductId
        hasExistingEbayOfferId
      />,
    );

    expect(screen.getByRole('button', { name: 'Update Shopify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update eBay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Both' })).toBeInTheDocument();
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

  it('renders marketplace admin and listing links when URLs are provided', () => {
    render(
      <ListingApprovalRecordActions
        {...baseProps}
        shopifyAdminListingUrl="https://example.myshopify.com/admin/products/123"
        shopifyServiceListingUrl="https://example.myshopify.com/products/vintage-amp"
        ebayAdminListingUrl="https://www.ebay.com/sh/lst/active"
        ebayServiceListingUrl="https://www.ebay.com/itm/1234567890"
      />,
    );

    expect(screen.getByRole('link', { name: 'Shopify Admin' })).toHaveAttribute('href', 'https://example.myshopify.com/admin/products/123');
    expect(screen.getByRole('link', { name: 'Shopify Listing' })).toHaveAttribute('href', 'https://example.myshopify.com/products/vintage-amp');
    expect(screen.getByRole('link', { name: 'eBay Seller' })).toHaveAttribute('href', 'https://www.ebay.com/sh/lst/active');
    expect(screen.getByRole('link', { name: 'eBay Listing' })).toHaveAttribute('href', 'https://www.ebay.com/itm/1234567890');
    expect(screen.getByRole('link', { name: 'eBay Seller' }).parentElement).toHaveClass('[&>a]:text-xs', '[&>a]:px-3');
    expect(screen.getByRole('button', { name: 'Save Updates' }).parentElement).toHaveClass('[&>button]:text-xs', '[&>button]:px-3');
  });
});