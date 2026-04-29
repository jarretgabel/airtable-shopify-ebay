import type { Dispatch, SetStateAction } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import type { EbayListingTemplateId } from '@/components/approval/listingApprovalEbayConstants';
import { useListingApprovalCombinedFieldState } from '@/components/approval/useListingApprovalCombinedFieldState';
import { useListingApprovalPreviewState } from '@/components/approval/useListingApprovalPreviewState';
import { useListingApprovalPublishState } from '@/components/approval/useListingApprovalPublishState';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalDerivedStateParams {
  records: AirtableRecord[];
  selectedRecordId: ApprovalTabViewModel['selectedRecordId'];
  allFieldNames: string[];
  approvalChannel: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  setFormValue: (fieldName: string, value: string) => void;
  ebayCategoryLabelsById: Record<string, string>;
  selectedEbayTemplateId: EbayListingTemplateId;
  setSelectedEbayTemplateId: Dispatch<SetStateAction<EbayListingTemplateId>>;
  tableReference: string;
  tableName?: string;
}

export function useListingApprovalDerivedState({
  records,
  selectedRecordId,
  allFieldNames,
  approvalChannel,
  isCombinedApproval,
  formValues,
  fieldKinds,
  setFormValue,
  ebayCategoryLabelsById,
  selectedEbayTemplateId,
  setSelectedEbayTemplateId,
  tableReference,
  tableName,
}: UseListingApprovalDerivedStateParams) {
  const combinedFieldState = useListingApprovalCombinedFieldState({
    records,
    selectedRecordId,
    allFieldNames,
    approvalChannel,
    isCombinedApproval,
    formValues,
    setFormValue,
    selectedEbayTemplateId,
    setSelectedEbayTemplateId,
  });

  const previewState = useListingApprovalPreviewState({
    approvalChannel,
    isCombinedApproval,
    selectedRecord: combinedFieldState.selectedRecord,
    fieldKinds,
    formValues,
    setFormValue,
    ebayCategoryLabelsById,
    selectedEbayTemplateId,
    combinedEbayBodyHtmlFieldName: combinedFieldState.combinedEbayBodyHtmlFieldName,
    combinedEbayTestingNotesFieldName: combinedFieldState.combinedEbayTestingNotesFieldName,
    combinedEbayTitleFieldName: combinedFieldState.combinedEbayTitleFieldName,
    combinedDescriptionFieldName: combinedFieldState.combinedDescriptionFieldName,
    combinedSharedKeyFeaturesFieldName: combinedFieldState.combinedSharedKeyFeaturesFieldName,
  });

  const publishState = useListingApprovalPublishState({
    allFieldNames,
    approvalChannel,
    formValues,
    mergedDraftSourceFields: previewState.mergedDraftSourceFields,
    selectedRecord: combinedFieldState.selectedRecord,
    combinedSharedFieldNames: combinedFieldState.combinedSharedFieldNames,
    combinedShopifyOnlyFieldNames: combinedFieldState.combinedShopifyOnlyFieldNames,
    combinedEbayOnlyFieldNames: combinedFieldState.combinedEbayOnlyFieldNames,
    tableReference,
    tableName,
  });

  return {
    ...combinedFieldState,
    ...previewState,
    ...publishState,
  };
}