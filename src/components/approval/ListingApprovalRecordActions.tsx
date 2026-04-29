interface ListingApprovalRecordActionsProps {
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
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
  accentActionButtonClass: string;
  primaryActionButtonClass: string;
  secondaryActionButtonClass: string;
}

export function ListingApprovalRecordActions({
  approvalChannel,
  isCombinedApproval,
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
  accentActionButtonClass,
  primaryActionButtonClass,
  secondaryActionButtonClass,
}: ListingApprovalRecordActionsProps) {
  return (
    <div className="mt-4 flex flex-wrap justify-end gap-3">
      <button
        type="button"
        className={secondaryActionButtonClass}
        onClick={onResetData}
        disabled={saving || !hasUnsavedChanges}
      >
        Reset data
      </button>
      <button
        type="button"
        className={primaryActionButtonClass}
        onClick={onSaveUpdates}
        disabled={saving}
      >
        {saving ? 'Saving...' : 'Save Updates'}
      </button>
      {isCombinedApproval && (
        <>
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={onPublishShopify}
            disabled={saving || approving || pushingTarget !== null || pushShopifyDisabled}
          >
            {pushingTarget === 'shopify'
              ? 'Publishing Shopify...'
              : pushShopifyDisabled
                  ? 'Complete Shopify Fields'
                  : 'Publish Shopify'}
          </button>
          <button
            type="button"
            className={secondaryActionButtonClass}
            onClick={onPublishEbay}
            disabled={saving || approving || pushingTarget !== null || pushEbayDisabled}
          >
            {pushingTarget === 'ebay'
              ? 'Publishing eBay...'
              : pushEbayDisabled
                  ? 'Complete eBay Fields'
                  : 'Publish eBay'}
          </button>
          <button
            type="button"
            className={accentActionButtonClass}
            onClick={onPublishBoth}
            disabled={saving || approving || pushingTarget !== null || pushBothDisabled}
          >
            {pushingTarget === 'both'
              ? 'Publishing Both...'
              : pushBothDisabled
                  ? 'Complete Required Fields'
                  : 'Publish Both'}
          </button>
        </>
      )}
      {!isCombinedApproval && (
        <button
          type="button"
          className={accentActionButtonClass}
          onClick={onPrimaryAction}
          disabled={
            saving
            || approving
            || pushingTarget !== null
            || hasUnsavedChanges
            || (!canUpdateApprovedShopifyListing && isApproved)
            || (approvalChannel === 'shopify' && hasMissingShopifyRequiredFields)
            || (approvalChannel === 'ebay' && hasMissingEbayRequiredFields)
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
        </button>
      )}
    </div>
  );
}