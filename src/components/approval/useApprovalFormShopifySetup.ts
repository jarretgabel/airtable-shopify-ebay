import {
  isShopifyBodyDescriptionField,
  isShopifyBodyHtmlPrimaryField,
  isShopifyBodyHtmlTemplateField,
  isShopifyKeyFeaturesField,
  isShopifyVendorField,
} from './approvalFormFieldsShopifyHelpersBasic';
import type { ApprovalFormFieldSetupParams } from './approvalFormFieldSetupTypes';
import { pickPreferredField } from './approvalFormFieldsImageHelpers';
import { useApprovalFormShopifyCollectionsSetup } from './useApprovalFormShopifyCollectionsSetup';
import { useApprovalFormShopifyTagsSetup } from './useApprovalFormShopifyTagsSetup';

type UseApprovalFormShopifySetupParams = Pick<ApprovalFormFieldSetupParams,
  'recordId'
  | 'approvalChannel'
  | 'isCombinedApproval'
  | 'forceShowShopifyCollectionsEditor'
  | 'allFieldNames'
  | 'writableFieldNames'
  | 'formValues'
  | 'fieldKinds'
  | 'normalizedShopifyTagValues'
  | 'normalizedShopifyCollectionIds'
  | 'normalizedShopifyCollectionLabelsById'
  | 'setFormValue'
  | 'setDerivedFormValue'
>;

export function useApprovalFormShopifySetup({
  recordId,
  approvalChannel,
  isCombinedApproval,
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
  const vendorFieldCandidates = Array.from(new Set([
    ...allFieldNames,
    ...writableFieldNames,
    ...Object.keys(formValues),
  ]));
  const shopifyVendorFieldName = isShopifyApprovalForm
    ? vendorFieldCandidates.find((fieldName) => isShopifyVendorField(fieldName))
    : undefined;
  const shopifyVendorDefaultValue = isShopifyApprovalForm && !isCombinedApproval
    ? (
      formValues.Make
      || formValues.Brand
      || formValues.Manufacturer
      || formValues['Item Brand']
      || formValues['Intake Brand']
      || ''
    ).trim()
    : '';
  const hasShopifyVendorEditor = Boolean(isShopifyApprovalForm && shopifyVendorFieldName);
  const shopifyBodyDescriptionCandidateFieldNames = isShopifyApprovalForm
    ? allFieldNames.filter((fieldName) => isShopifyBodyDescriptionField(fieldName))
    : [];
  const shopifyBodyDescriptionFieldName = isShopifyApprovalForm
    ? pickPreferredField(
      shopifyBodyDescriptionCandidateFieldNames,
      [
        'Shopify REST Body Description',
        'Shopify Body Description',
        'shopify_rest_body_description',
        'shopify_body_description',
        'Item Description',
        'Description',
      ],
      formValues,
    )
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
    hasShopifyVendorEditor,
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
    shopifyVendorDefaultValue,
    shopifyVendorFieldName,
  };
}