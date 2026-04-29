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
  selectedEbayTemplateId,
  onEbayTemplateIdChange,
}: UseApprovalFormEbaySetupParams) {
  const categorySetup = useApprovalFormEbayCategorySetup({
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