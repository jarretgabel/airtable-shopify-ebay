import type { UseListingApprovalRecordActionsParams } from './listingApprovalRecordActionTypes';
import { useListingApprovalSaveActions } from './useListingApprovalSaveActions';

type PersistenceActionsParams = Pick<UseListingApprovalRecordActionsParams,
  'selectedRecord'
  | 'approvalChannel'
  | 'allFieldNames'
  | 'approvedFieldName'
  | 'actualFieldNames'
  | 'tableReference'
  | 'tableName'
  | 'formValues'
  | 'setFormValue'
  | 'hydrateForm'
  | 'saveRecord'
  | 'bodyHtmlPreview'
  | 'ebayBodyHtmlSaveFieldName'
  | 'shouldForceEbayBodyHtmlSave'
  | 'combinedSharedKeyFeaturesFieldName'
  | 'combinedEbayTestingNotesFieldName'
  | 'priceFieldName'
  | 'pushInlineActionNotice'
  | 'changedFieldNames'
  | 'requestConfirmation'
>;

export function useListingApprovalPersistenceActions({
  selectedRecord,
  approvalChannel,
  allFieldNames,
  approvedFieldName,
  actualFieldNames,
  tableReference,
  tableName,
  formValues,
  setFormValue,
  hydrateForm,
  saveRecord,
  bodyHtmlPreview,
  ebayBodyHtmlSaveFieldName,
  shouldForceEbayBodyHtmlSave,
  combinedSharedKeyFeaturesFieldName,
  combinedEbayTestingNotesFieldName,
  priceFieldName,
  pushInlineActionNotice,
  changedFieldNames,
  requestConfirmation,
}: PersistenceActionsParams) {
  return useListingApprovalSaveActions({
    selectedRecord,
    approvalChannel,
    allFieldNames,
    approvedFieldName,
    actualFieldNames,
    tableReference,
    tableName,
    formValues,
    setFormValue,
    hydrateForm,
    saveRecord,
    bodyHtmlPreview,
    ebayBodyHtmlSaveFieldName,
    shouldForceEbayBodyHtmlSave,
    combinedSharedKeyFeaturesFieldName,
    combinedEbayTestingNotesFieldName,
    priceFieldName,
    pushInlineActionNotice,
    changedFieldNames,
    requestConfirmation,
  });
}