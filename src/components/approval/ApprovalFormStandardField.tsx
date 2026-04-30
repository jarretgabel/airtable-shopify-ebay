import { type JSX } from 'react';

import {
  getDropdownOptions,
} from '@/stores/approvalStore';
import {
  getEbayAdvancedOptionDefaultValue,
  isEbayFormatField,
  isEbayListingDurationField,
  isEbayPackageTypeField,
  isEbayShippingTypeField,
} from './approvalFormFieldsEbayHelpers';
import {
  isReadOnlyApprovalField,
} from './approvalFormFieldsSharedHelpers';
import {
} from './approvalFormFieldsEbayHelpersBasic';
import {
  renderApprovalFormBooleanField,
  renderApprovalFormDropdownField,
  renderApprovalFormSpecialField,
  renderApprovalFormTextField,
} from './approvalFormStandardFieldRenderers';
import {
  isApprovalFieldBooleanLike,
  shouldHideApprovalFormStandardField,
} from './approvalFormStandardFieldVisibility';

interface ApprovalFormStandardFieldProps {
  fieldName: string;
  allowAdvancedOptionField?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  isCombinedApproval: boolean;
  allFieldNames: string[];
  hasEbayShippingServicesEditor: boolean;
  approvedFieldName: string;
  hasShopifyTagEditor: boolean;
  hasShopifyCollectionEditor: boolean;
  shopifyBodyDescriptionFieldName?: string;
  ebayBodyDescriptionFieldName?: string;
  shopifyBodyHtmlFieldName?: string;
  shopifyBodyHtmlTemplateFieldName?: string;
  ebayBodyHtmlFieldName?: string;
  ebayBodyHtmlTemplateFieldName?: string;
  shopifyKeyFeaturesFieldName?: string;
  ebayKeyFeaturesFieldName?: string;
  ebayTestingNotesFieldName?: string;
  ebayAttributesCandidateFieldNames: string[];
  hasEbayCategoryEditor: boolean;
  ebayCategoriesFieldName?: string;
  effectiveEbayCategoriesFieldName: string;
  preferredShopifyPriceFieldName?: string;
  imageUrlSourceField?: string;
  useCombinedImageAltEditor: boolean;
  imageAltTextSourceField?: string;
  suppressImageScalarFields: boolean;
  hasCanonicalConditionField: boolean;
  formValues: Record<string, string>;
  fieldKinds: Record<string, 'boolean' | 'number' | 'json' | 'text'>;
  saving: boolean;
  listingFormatOptions: string[];
  listingDurationOptions: string[];
  ebayPackageTypeOptions: string[];
  setFormValue: (fieldName: string, value: string) => void;
  isRequiredField: (fieldName: string) => boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  toFieldLabel: (fieldName: string) => string;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extra?: string) => string;
}

export function ApprovalFormStandardField({
  fieldName,
  allowAdvancedOptionField = false,
  approvalChannel,
  isCombinedApproval,
  allFieldNames,
  hasEbayShippingServicesEditor,
  approvedFieldName,
  hasShopifyTagEditor,
  hasShopifyCollectionEditor,
  shopifyBodyDescriptionFieldName,
  ebayBodyDescriptionFieldName,
  shopifyBodyHtmlFieldName,
  shopifyBodyHtmlTemplateFieldName,
  ebayBodyHtmlFieldName,
  ebayBodyHtmlTemplateFieldName,
  shopifyKeyFeaturesFieldName,
  ebayKeyFeaturesFieldName,
  ebayTestingNotesFieldName,
  ebayAttributesCandidateFieldNames,
  hasEbayCategoryEditor,
  ebayCategoriesFieldName,
  effectiveEbayCategoriesFieldName,
  preferredShopifyPriceFieldName,
  imageUrlSourceField,
  useCombinedImageAltEditor,
  imageAltTextSourceField,
  suppressImageScalarFields,
  hasCanonicalConditionField,
  formValues,
  fieldKinds,
  saving,
  listingFormatOptions,
  listingDurationOptions,
  ebayPackageTypeOptions,
  setFormValue,
  isRequiredField,
  renderFieldLabel,
  toFieldLabel,
  getSelectClassName,
  getInputClassName,
}: ApprovalFormStandardFieldProps) {
  if (shouldHideApprovalFormStandardField({
    fieldName,
    allowAdvancedOptionField,
    approvalChannel,
    isCombinedApproval,
    allFieldNames,
    hasEbayShippingServicesEditor,
    approvedFieldName,
    hasShopifyTagEditor,
    hasShopifyCollectionEditor,
    shopifyBodyDescriptionFieldName,
    ebayBodyDescriptionFieldName,
    shopifyBodyHtmlFieldName,
    shopifyBodyHtmlTemplateFieldName,
    ebayBodyHtmlFieldName,
    ebayBodyHtmlTemplateFieldName,
    shopifyKeyFeaturesFieldName,
    ebayKeyFeaturesFieldName,
    ebayTestingNotesFieldName,
    ebayAttributesCandidateFieldNames,
    hasEbayCategoryEditor,
    ebayCategoriesFieldName,
    effectiveEbayCategoriesFieldName,
    preferredShopifyPriceFieldName,
    imageUrlSourceField,
    useCombinedImageAltEditor,
    imageAltTextSourceField,
    suppressImageScalarFields,
    hasCanonicalConditionField,
  })) return null;

  const storedValue = formValues[fieldName] ?? '';
  const defaultValue = allowAdvancedOptionField ? getEbayAdvancedOptionDefaultValue(fieldName) : '';
  const value = storedValue || defaultValue;
  const kind = fieldKinds[fieldName] ?? 'text';
  const readOnlyField = isReadOnlyApprovalField(fieldName);
  const inputDisabled = saving || readOnlyField;
  const isListingFormatField = isEbayFormatField(fieldName);
  const isListingDurationField = isEbayListingDurationField(fieldName);
  const isPackageTypeField = isEbayPackageTypeField(fieldName);
  const dropdownOptions = isListingFormatField
    ? listingFormatOptions
    : (isListingDurationField && listingDurationOptions)
      ? listingDurationOptions
      : isPackageTypeField
        ? ebayPackageTypeOptions
        : getDropdownOptions(fieldName);

  if (isApprovalFieldBooleanLike(fieldName, kind, value)) {
    return renderApprovalFormBooleanField({
      fieldName,
      kind,
      value,
      inputDisabled,
      isRequiredField,
      renderFieldLabel,
      toFieldLabel,
      getSelectClassName,
      getInputClassName,
      setFormValue,
    });
  }

  if (dropdownOptions) {
    return renderApprovalFormDropdownField({
      fieldName,
      kind,
      value,
      inputDisabled,
      dropdownOptions,
      isRequiredField,
      renderFieldLabel,
      toFieldLabel,
      getSelectClassName,
      getInputClassName,
      setFormValue,
      isShippingTypeDropdown: isEbayShippingTypeField(fieldName),
      isListingDurationField,
    });
  }

  const specialField = renderApprovalFormSpecialField({
    fieldName,
    kind,
    value,
    inputDisabled,
    isRequiredField,
    renderFieldLabel,
    toFieldLabel,
    getSelectClassName,
    getInputClassName,
    setFormValue,
  });
  if (specialField) {
    return specialField;
  }

  return renderApprovalFormTextField({
    fieldName,
    kind,
    value,
    inputDisabled,
    isRequiredField,
    renderFieldLabel,
    toFieldLabel,
    getSelectClassName,
    getInputClassName,
    setFormValue,
  });
}