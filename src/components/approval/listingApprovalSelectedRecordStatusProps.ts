import type { ComponentProps } from 'react';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';

type ListingApprovalRecordAlertsProps = ComponentProps<typeof ListingApprovalRecordAlerts>;
type ListingApprovalRecordActionsProps = ComponentProps<typeof ListingApprovalRecordActions>;

interface BuildListingApprovalSelectedRecordStatusPropsParams {
  approvalChannel: ListingApprovalRecordAlertsProps['approvalChannel'];
  isCombinedApproval: ListingApprovalRecordActionsProps['isCombinedApproval'];
  workflowStatus?: string | null;
  workflowReadinessMissingRequirements?: string[];
  saving: boolean;
  approving: boolean;
  pushingTarget: ListingApprovalRecordActionsProps['pushingTarget'];
  hasUnsavedChanges: boolean;
  changedFieldNames: string[];
  hasMissingShopifyRequiredFields: boolean;
  missingShopifyRequiredFieldNames: string[];
  missingShopifyRequiredFieldLabels: string[];
  hasMissingEbayRequiredFields: boolean;
  missingEbayRequiredFieldNames: string[];
  missingEbayRequiredFieldLabels: string[];
  inlineActionNotices: ListingApprovalRecordAlertsProps['inlineActionNotices'];
  fadingInlineNoticeIds: string[];
  canUpdateApprovedShopifyListing: boolean;
  isApproved: boolean;
  hasExistingEbayOfferId: boolean;
  hasExistingShopifyRestProductId: boolean;
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
  onPrimaryAction: () => void;
  runCombinedPush: (target: 'shopify' | 'ebay' | 'both') => Promise<void> | void;
}

export function buildListingApprovalSelectedRecordStatusProps({
  approvalChannel,
  isCombinedApproval,
  workflowStatus,
  workflowReadinessMissingRequirements,
  saving,
  approving,
  pushingTarget,
  hasUnsavedChanges,
  changedFieldNames,
  hasMissingShopifyRequiredFields,
  missingShopifyRequiredFieldNames,
  missingShopifyRequiredFieldLabels,
  hasMissingEbayRequiredFields,
  missingEbayRequiredFieldNames,
  missingEbayRequiredFieldLabels,
  inlineActionNotices,
  fadingInlineNoticeIds,
  canUpdateApprovedShopifyListing,
  isApproved,
  hasExistingEbayOfferId,
  hasExistingShopifyRestProductId,
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
  onPrimaryAction,
  runCombinedPush,
}: BuildListingApprovalSelectedRecordStatusPropsParams) {
  return {
    alertsProps: {
      approvalChannel,
      workflowStatus,
      workflowReadinessMissingRequirements,
      hasUnsavedChanges,
      changedFieldNames,
      hasMissingShopifyRequiredFields,
      missingShopifyRequiredFieldNames,
      missingShopifyRequiredFieldLabels,
      hasMissingEbayRequiredFields,
      missingEbayRequiredFieldNames,
      missingEbayRequiredFieldLabels,
      inlineActionNotices,
      fadingInlineNoticeIds,
    } satisfies ListingApprovalRecordAlertsProps,
    actionsProps: {
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
      onPublishShopify: () => { void runCombinedPush('shopify'); },
      onPublishEbay: () => { void runCombinedPush('ebay'); },
      onPublishBoth: () => { void runCombinedPush('both'); },
      onPrimaryAction,
    } satisfies ListingApprovalRecordActionsProps,
  };
}