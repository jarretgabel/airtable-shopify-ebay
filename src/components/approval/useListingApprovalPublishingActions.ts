import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';
import { useListingApprovalApproveAction } from './useListingApprovalApproveAction';
import { useListingApprovalPublishActions } from './useListingApprovalPublishActions';

type PublishingActionsParams = Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'approvalChannel'
  | 'actualFieldNames'
  | 'approvedFieldName'
  | 'tableReference'
  | 'tableName'
  | 'formValues'
  | 'setFormValue'
  | 'saveRecord'
  | 'createShopifyDraftOnApprove'
  | 'shopifyApprovalPreview'
  | 'loadShopifyApprovalPreviewNow'
  | 'syncExistingShopifyListing'
  | 'describeShopifyCreateError'
  | 'resolveShopifyCategoryId'
  | 'upsertShopifyProductWithCollectionFallback'
  | 'canUpdateApprovedShopifyListing'
  | 'hasMissingShopifyRequiredFields'
  | 'hasMissingEbayRequiredFields'
  | 'missingShopifyRequiredFieldLabels'
  | 'missingEbayRequiredFieldLabels'
  | 'approvalPublishSource'
  | 'mergedDraftSourceFields'
  | 'onBackToList'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>;

export function useListingApprovalPublishingActions({
  selectedRecord,
  approvalChannel,
  actualFieldNames,
  approvedFieldName,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  saveRecord,
  createShopifyDraftOnApprove,
  shopifyApprovalPreview,
  loadShopifyApprovalPreviewNow,
  syncExistingShopifyListing,
  describeShopifyCreateError,
  resolveShopifyCategoryId,
  upsertShopifyProductWithCollectionFallback,
  canUpdateApprovedShopifyListing,
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  approvalPublishSource,
  mergedDraftSourceFields,
  onBackToList,
  pushInlineActionNotice,
  requestConfirmation,
}: PublishingActionsParams) {
  const { pushingTarget, runCombinedPush } = useListingApprovalPublishActions({
    selectedRecord,
    hasMissingShopifyRequiredFields,
    hasMissingEbayRequiredFields,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    approvalPublishSource,
    mergedDraftSourceFields,
    setFormValue,
    pushInlineActionNotice,
    requestConfirmation,
  });

  const { approving, handlePrimaryAction } = useListingApprovalApproveAction({
    selectedRecord,
    approvalChannel,
    actualFieldNames,
    approvedFieldName,
    tableReference,
    tableName,
    formValues,
    setFormValue,
    saveRecord,
    createShopifyDraftOnApprove,
    shopifyApprovalPreview,
    loadShopifyApprovalPreviewNow,
    syncExistingShopifyListing,
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    upsertShopifyProductWithCollectionFallback,
    canUpdateApprovedShopifyListing,
    hasMissingShopifyRequiredFields,
    hasMissingEbayRequiredFields,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    onBackToList,
    pushInlineActionNotice,
    requestConfirmation,
  });

  return {
    approving,
    pushingTarget,
    handlePrimaryAction,
    runCombinedPush,
  };
}