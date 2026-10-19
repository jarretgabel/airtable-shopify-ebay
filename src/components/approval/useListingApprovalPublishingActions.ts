import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';
import { useListingApprovalApproveAction } from './useListingApprovalApproveAction';
import { useListingApprovalPublishActions } from './useListingApprovalPublishActions';

type PublishingActionsParams = Omit<Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'approvalChannel'
  | 'actualFieldNames'
  | 'approvedFieldName'
  | 'tableReference'
  | 'tableName'
  | 'formValues'
  | 'setFormValue'
  | 'setDerivedFormValue'
  | 'saveRecord'
  | 'createShopifyDraftOnApprove'
  | 'shopifyApprovalPreview'
  | 'loadShopifyApprovalPreviewNow'
  | 'syncExistingShopifyListing'
  | 'describeShopifyCreateError'
  | 'resolveShopifyCategoryId'
  | 'upsertShopifyProductWithCollectionFallback'
  | 'canUpdateApprovedShopifyListing'
  | 'changedFieldNames'
  | 'hasMissingShopifyRequiredFields'
  | 'hasMissingEbayRequiredFields'
  | 'missingShopifyRequiredFieldLabels'
  | 'missingEbayRequiredFieldLabels'
  | 'approvalPublishSource'
  | 'mergedDraftSourceFields'
  | 'ebayGeneratedBodyHtml'
  | 'workflowPublishSummary'
  | 'onBackToList'
  | 'pushInlineActionNotice'
  | 'requestConfirmation'
>, 'changedFieldNames'> & {
  changedFieldNames?: string[];
  savePendingUpdates?: () => Promise<boolean>;
};

export function useListingApprovalPublishingActions({
  selectedRecord,
  approvalChannel,
  actualFieldNames,
  approvedFieldName,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  setDerivedFormValue,
  saveRecord,
  createShopifyDraftOnApprove,
  shopifyApprovalPreview,
  loadShopifyApprovalPreviewNow,
  syncExistingShopifyListing,
  describeShopifyCreateError,
  resolveShopifyCategoryId,
  upsertShopifyProductWithCollectionFallback,
  canUpdateApprovedShopifyListing,
  changedFieldNames = [],
  hasMissingShopifyRequiredFields,
  hasMissingEbayRequiredFields,
  missingShopifyRequiredFieldLabels,
  missingEbayRequiredFieldLabels,
  approvalPublishSource,
  mergedDraftSourceFields,
  ebayGeneratedBodyHtml,
  workflowPublishSummary,
  onBackToList,
  pushInlineActionNotice,
  requestConfirmation,
  savePendingUpdates,
}: PublishingActionsParams) {
  const { pushingTarget, runCombinedPush } = useListingApprovalPublishActions({
    selectedRecord,
    changedFieldNames,
    ...(savePendingUpdates ? { savePendingUpdates } : {}),
    hasMissingShopifyRequiredFields,
    hasMissingEbayRequiredFields,
    missingShopifyRequiredFieldLabels,
    missingEbayRequiredFieldLabels,
    approvalPublishSource,
    tableReference,
    tableName,
    mergedDraftSourceFields,
    ebayGeneratedBodyHtml,
    workflowPublishSummary,
    setFormValue,
    setDerivedFormValue,
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
    approvalPublishSource,
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