import {
  isShopifyBodyDescriptionField,
  isShopifyBodyHtmlPrimaryField,
  isShopifyBodyHtmlTemplateField,
  isShopifyKeyFeaturesField,
} from './approvalFormFieldsShopifyHelpersBasic';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';
import { useApprovalFormShopifyCollectionsSetup } from './useApprovalFormShopifyCollectionsSetup';
import { useApprovalFormShopifyTagsSetup } from './useApprovalFormShopifyTagsSetup';

type UseApprovalFormShopifySetupParams = Pick<ApprovalFormFieldSetupParams,
  'recordId'
  | 'approvalChannel'
  | 'forceShowShopifyCollectionsEditor'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'fieldKinds'
  | 'normalizedShopifyTagValues'
  | 'normalizedShopifyCollectionIds'
  | 'normalizedShopifyCollectionLabelsById'
  | 'setFormValue'
>;

export function useApprovalFormShopifySetup({
  recordId,
  approvalChannel,
  forceShowShopifyCollectionsEditor,
  allFieldNames,
  writableFieldNames,
  formValues,
  fieldKinds,
  normalizedShopifyTagValues,
  normalizedShopifyCollectionIds,
  normalizedShopifyCollectionLabelsById,
  setFormValue,
}: UseApprovalFormShopifySetupParams) {
  const isShopifyApprovalForm = approvalChannel === 'shopify';
  const shopifyBodyDescriptionFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyDescriptionField(fieldName))
    : undefined;
  const shopifyKeyFeaturesCandidateFieldNames = isShopifyApprovalForm
    ? allFieldNames.filter((fieldName) => isShopifyKeyFeaturesField(fieldName))
    : [];
  const shopifyKeyFeaturesFieldName = isShopifyApprovalForm
    ? shopifyKeyFeaturesCandidateFieldNames.find((fieldName) => {
      const normalized = fieldName.trim().toLowerCase();
      return normalized === 'key features'
        || normalized === 'key features json'
        || normalized === 'features'
        || normalized === 'features json'
        || normalized === 'shopify body key features json'
        || normalized === 'shopify rest body key features json'
        || normalized === 'shopify body key features'
        || normalized === 'shopify rest body key features';
    }) ?? shopifyKeyFeaturesCandidateFieldNames[0]
    : undefined;
  const shopifyKeyFeaturesSyncFieldNames = shopifyKeyFeaturesCandidateFieldNames.filter((fieldName) => fieldName !== shopifyKeyFeaturesFieldName);
  const shopifyBodyHtmlFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlPrimaryField(fieldName))
    : undefined;
  const shopifyBodyHtmlTemplateFieldName = isShopifyApprovalForm
    ? allFieldNames.find((fieldName) => isShopifyBodyHtmlTemplateField(fieldName))
    : undefined;
  const {
    hasShopifyTagEditor,
    setShopifyTagValues,
    shopifyTagStrategy,
    shopifyTagValues,
  } = useApprovalFormShopifyTagsSetup({
    allFieldNames,
    writableFieldNames,
    formValues,
    fieldKinds,
    normalizedShopifyTagValues,
    setFormValue,
  });
  const {
    effectiveCollectionEditorLabelsById,
    effectiveShopifyCollectionIds,
    hasShopifyCollectionEditor,
    setShopifyCollectionIds,
    shopifyCollectionStrategy,
  } = useApprovalFormShopifyCollectionsSetup({
    recordId,
    forceShowShopifyCollectionsEditor,
    allFieldNames,
    writableFieldNames,
    formValues,
    fieldKinds,
    normalizedShopifyCollectionIds,
    normalizedShopifyCollectionLabelsById,
    setFormValue,
  });

  return {
    effectiveCollectionEditorLabelsById,
    effectiveShopifyCollectionIds,
    hasShopifyCollectionEditor,
    hasShopifyTagEditor,
    isShopifyApprovalForm,
    setShopifyCollectionIds,
    setShopifyTagValues,
    shopifyBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    shopifyCollectionStrategy,
    shopifyKeyFeaturesFieldName,
    shopifyKeyFeaturesSyncFieldNames,
    shopifyTagStrategy,
    shopifyTagValues,
  };
}