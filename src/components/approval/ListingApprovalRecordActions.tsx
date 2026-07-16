import { AccentActionButton } from '@/components/app/AccentActionButton';
import { PrimaryActionButton } from '@/components/app/PrimaryActionButton';
import { SecondaryActionButton } from '@/components/app/SecondaryActionButton';

interface ListingApprovalRecordActionsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  workflowStatus?: string | null;
  saving: boolean;
  approving: boolean;
  pushingTarget: 'shopify' | 'ebay' | 'both' | null;
  hasUnsavedChanges: boolean;
  canUpdateApprovedShopifyListing: boolean;
  isApproved: boolean;
  hasExistingEbayOfferId: boolean;
  hasExistingShopifyRestProductId: boolean;
  hasMissingShopifyRequiredFields: boolean;
  hasMissingEbayRequiredFields: boolean;
  pushShopifyDisabled: boolean;
  pushEbayDisabled: boolean;
  pushBothDisabled: boolean;
  isShopifyPublishBlockedByAuctionFormat: boolean;
  shopifyAdminListingUrl: string | null;
  shopifyServiceListingUrl: string | null;
  ebayAdminListingUrl: string | null;
  ebayServiceListingUrl: string | null;
  onResetData: () => void;
  onSaveUpdates: () => void;
  onPublishShopify: () => void;
  onPublishEbay: () => void;
  onPublishBoth: () => void;
  onPrimaryAction: () => void;
}

export function ListingApprovalRecordActions({
  approvalChannel,
  isCombinedApproval,
  workflowStatus,
  saving,
  approving,
  pushingTarget,
  hasUnsavedChanges,
  canUpdateApprovedShopifyListing,
  isApproved,
  hasExistingEbayOfferId,
  hasExistingShopifyRestProductId,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  pushShopifyDisabled,
  pushEbayDisabled,
  pushBothDisabled,
  isShopifyPublishBlockedByAuctionFormat,
  shopifyAdminListingUrl,
  shopifyServiceListingUrl,
  ebayAdminListingUrl,
  ebayServiceListingUrl,
  onResetData,
  onSaveUpdates,
  onPublishShopify,
  onPublishEbay,
  onPublishBoth,
  onPrimaryAction,
}: ListingApprovalRecordActionsProps) {
  const isWorkflowListingReview = isCombinedApproval && workflowStatus === 'Awaiting Pre-Listing Review';
  const showCombinedPublishButtons = isCombinedApproval && !isWorkflowListingReview;
  const isPostPublishLocked = workflowStatus === 'Sold - Ready to Ship' || workflowStatus === 'Shipped';
  const shouldForcePublishLabels = workflowStatus === 'Approved for Publish' || workflowStatus === 'Awaiting Pre-Listing Review';
  const hasExistingShopifyForActionLabel = hasExistingShopifyRestProductId && !shouldForcePublishLabels;
  const hasExistingEbayForActionLabel = hasExistingEbayOfferId && !shouldForcePublishLabels;
  const shopifyActionLabel = hasExistingShopifyForActionLabel ? 'Update Shopify' : 'Publish Shopify';
  const ebayActionLabel = hasExistingEbayForActionLabel ? 'Update eBay' : 'Publish eBay';
  const bothActionLabel = hasExistingShopifyForActionLabel && hasExistingEbayForActionLabel
    ? 'Update Both'
    : hasExistingShopifyForActionLabel
      ? 'Update Shopify + Publish eBay'
      : hasExistingEbayForActionLabel
        ? 'Publish Shopify + Update eBay'
        : 'Publish Both';

  return (
    <div className="mt-4 flex flex-wrap justify-end gap-3">
      <SecondaryActionButton
        onClick={onResetData}
        disabled={saving || !hasUnsavedChanges}
      >
        Reset data
      </SecondaryActionButton>
      <PrimaryActionButton
        onClick={onSaveUpdates}
        disabled={saving || isPostPublishLocked}
      >
        {saving ? 'Saving...' : 'Save Updates'}
      </PrimaryActionButton>
      {shopifyAdminListingUrl && (
        <SecondaryActionButton href={shopifyAdminListingUrl} target="_blank" rel="noreferrer noopener">
          Open Shopify Admin
        </SecondaryActionButton>
      )}
      {shopifyServiceListingUrl && (
        <SecondaryActionButton href={shopifyServiceListingUrl} target="_blank" rel="noreferrer noopener">
          Open Shopify Listing
        </SecondaryActionButton>
      )}
      {ebayAdminListingUrl && (
        <SecondaryActionButton href={ebayAdminListingUrl} target="_blank" rel="noreferrer noopener">
          Open eBay Seller
        </SecondaryActionButton>
      )}
      {ebayServiceListingUrl && (
        <SecondaryActionButton href={ebayServiceListingUrl} target="_blank" rel="noreferrer noopener">
          Open eBay Listing
        </SecondaryActionButton>
      )}
      {isWorkflowListingReview && (
        <AccentActionButton
          onClick={onPrimaryAction}
          disabled={saving || approving || hasUnsavedChanges || hasMissingShopifyRequiredFields || hasMissingEbayRequiredFields}
        >
          {approving
            ? 'Approving for Publish...'
            : hasUnsavedChanges
              ? 'Save Updates Before Approving'
              : hasMissingShopifyRequiredFields || hasMissingEbayRequiredFields
                ? 'Complete Required Fields'
                : 'Approve for Publish'}
        </AccentActionButton>
      )}
      {showCombinedPublishButtons && !isPostPublishLocked && (
        <>
          <SecondaryActionButton
            onClick={onPublishShopify}
            disabled={saving || approving || pushingTarget !== null || pushShopifyDisabled}
          >
            {pushingTarget === 'shopify'
              ? (hasExistingShopifyForActionLabel ? 'Updating Shopify...' : 'Publishing Shopify...')
              : isShopifyPublishBlockedByAuctionFormat
                  ? 'Set Buy It Now Format'
                  : pushShopifyDisabled
                  ? 'Complete Shopify Fields'
                  : shopifyActionLabel}
          </SecondaryActionButton>
          <SecondaryActionButton
            onClick={onPublishEbay}
            disabled={saving || approving || pushingTarget !== null || pushEbayDisabled}
          >
            {pushingTarget === 'ebay'
              ? (hasExistingEbayForActionLabel ? 'Updating eBay...' : 'Publishing eBay...')
              : pushEbayDisabled
                  ? 'Complete eBay Fields'
                  : ebayActionLabel}
          </SecondaryActionButton>
          <AccentActionButton
            onClick={onPublishBoth}
            disabled={saving || approving || pushingTarget !== null || pushBothDisabled}
          >
            {pushingTarget === 'both'
              ? (hasExistingShopifyForActionLabel || hasExistingEbayForActionLabel ? 'Updating / Publishing...' : 'Publishing Both...')
              : isShopifyPublishBlockedByAuctionFormat
                  ? 'Set Buy It Now Format'
                  : pushBothDisabled
                  ? 'Complete Required Fields'
                  : bothActionLabel}
          </AccentActionButton>
        </>
      )}
      {!isCombinedApproval && (
        <AccentActionButton
          onClick={onPrimaryAction}
          disabled={
            saving
            || approving
            || pushingTarget !== null
            || hasUnsavedChanges
            || (!canUpdateApprovedShopifyListing && isApproved)
            || (approvalChannel === 'shopify' && hasMissingShopifyRequiredFields)
            || (approvalChannel === 'ebay' && hasMissingEbayRequiredFields)
            || isPostPublishLocked
          }
        >
          {approving
            ? (canUpdateApprovedShopifyListing ? 'Updating...' : 'Approving...')
            : hasUnsavedChanges
              ? (canUpdateApprovedShopifyListing ? 'Save Updates Before Updating' : 'Save Updates Before Approving')
              : canUpdateApprovedShopifyListing
                ? 'Update Listing'
                : isApproved
                  ? 'Already Approved'
                  : approvalChannel === 'shopify' && hasMissingShopifyRequiredFields
                    ? 'Complete Required Shopify Fields'
                    : approvalChannel === 'ebay' && hasMissingEbayRequiredFields
                      ? 'Complete Required eBay Fields'
                      : (hasExistingShopifyRestProductId ? 'Update Listing' : 'Approve Listing')}
        </AccentActionButton>
      )}
    </div>
  );
}