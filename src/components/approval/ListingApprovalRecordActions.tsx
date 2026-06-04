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
  hasExistingShopifyRestProductId: boolean;
  hasMissingShopifyRequiredFields: boolean;
  hasMissingEbayRequiredFields: boolean;
  pushShopifyDisabled: boolean;
  pushEbayDisabled: boolean;
  pushBothDisabled: boolean;
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
  hasExistingShopifyRestProductId,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  pushShopifyDisabled,
  pushEbayDisabled,
  pushBothDisabled,
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
              ? 'Publishing Shopify...'
              : pushShopifyDisabled
                  ? 'Complete Shopify Fields'
                  : 'Publish Shopify'}
          </SecondaryActionButton>
          <SecondaryActionButton
            onClick={onPublishEbay}
            disabled={saving || approving || pushingTarget !== null || pushEbayDisabled}
          >
            {pushingTarget === 'ebay'
              ? 'Publishing eBay...'
              : pushEbayDisabled
                  ? 'Complete eBay Fields'
                  : 'Publish eBay'}
          </SecondaryActionButton>
          <AccentActionButton
            onClick={onPublishBoth}
            disabled={saving || approving || pushingTarget !== null || pushBothDisabled}
          >
            {pushingTarget === 'both'
              ? 'Publishing Both...'
              : pushBothDisabled
                  ? 'Complete Required Fields'
                  : 'Publish Both'}
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