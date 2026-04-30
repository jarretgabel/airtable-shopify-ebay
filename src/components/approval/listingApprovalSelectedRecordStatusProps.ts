import type { ComponentProps } from 'react';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';

type ListingApprovalRecordAlertsProps = ComponentProps<typeof ListingApprovalRecordAlerts>;
type ListingApprovalRecordActionsProps = ComponentProps<typeof ListingApprovalRecordActions>;

interface BuildListingApprovalSelectedRecordStatusPropsParams {
  approvalChannel: ListingApprovalRecordAlertsProps['approvalChannel'];
  isCombinedApproval: ListingApprovalRecordActionsProps['isCombinedApproval'];
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
  hasExistingShopifyRestProductId: boolean;
  pushShopifyDisabled: boolean;
  pushEbayDisabled: boolean;
  pushBothDisabled: boolean;
  onResetData: () => void;
  onSaveUpdates: () => void;
  onPrimaryAction: () => void;
  runCombinedPush: (target: 'shopify' | 'ebay' | 'both') => Promise<void> | void;
  accentActionButtonClass: string;
  primaryActionButtonClass: string;
  secondaryActionButtonClass: string;
}

export function buildListingApprovalSelectedRecordStatusProps({
  approvalChannel,
  isCombinedApproval,
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
  hasExistingShopifyRestProductId,
  pushShopifyDisabled,
  pushEbayDisabled,
  pushBothDisabled,
  onResetData,
  onSaveUpdates,
  onPrimaryAction,
  runCombinedPush,
  accentActionButtonClass,
  primaryActionButtonClass,
  secondaryActionButtonClass,
}: BuildListingApprovalSelectedRecordStatusPropsParams) {
  return {
    alertsProps: {
      approvalChannel,
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
      onPublishShopify: () => { void runCombinedPush('shopify'); },
      onPublishEbay: () => { void runCombinedPush('ebay'); },
      onPublishBoth: () => { void runCombinedPush('both'); },
      onPrimaryAction,
      accentActionButtonClass,
      primaryActionButtonClass,
      secondaryActionButtonClass,
    } satisfies ListingApprovalRecordActionsProps,
  };
}