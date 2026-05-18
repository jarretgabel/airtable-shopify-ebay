import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';
import { useApprovalFormEbayCategorySetup } from './useApprovalFormEbayCategorySetup';
import { useApprovalFormEbayEditorSetup } from './useApprovalFormEbayEditorSetup';

type UseApprovalFormEbaySetupParams = Pick<ApprovalFormFieldSetupParams,
  'recordId'
  | 'approvalChannel'
  | 'isCombinedApproval'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'originalFieldValues'
  | 'setFormValue'
  | 'setDerivedFormValue'
  | 'selectedEbayTemplateId'
  | 'onEbayTemplateIdChange'
>;

export function useApprovalFormEbaySetup({
  recordId,
  approvalChannel,
  isCombinedApproval,
  allFieldNames,
  writableFieldNames,
  formValues,
  originalFieldValues,
  setFormValue,
  setDerivedFormValue,
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
}: UseApprovalFormEbaySetupParams) {
  const categorySetup = useApprovalFormEbayCategorySetup({
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    writableFieldNames,
    formValues,
    originalFieldValues,
    setFormValue,
  });
  const editorSetup = useApprovalFormEbayEditorSetup({
    recordId,
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    writableFieldNames,
    formValues,
    originalFieldValues,
    setFormValue,
    setDerivedFormValue,
    selectedEbayTemplateId,
    onEbayTemplateIdChange,
    ebayMarketplaceId: categorySetup.ebayMarketplaceId,
    isEbayListingForm: categorySetup.isEbayListingForm,
  });

  return {
    ...categorySetup,
    ...editorSetup,
  };
}