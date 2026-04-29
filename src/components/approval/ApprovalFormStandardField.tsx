import { type ChangeEvent, type JSX } from 'react';

import {
  getDropdownOptions,
} from '@/stores/approvalStore';
import { ApprovalSelect } from './ApprovalSelect';
import {
  getEbayAdvancedOptionDefaultValue,
  getEbayListingDurationLabel,
  getEbayShippingTypeLabel,
  isEbayFormatField,
  isEbayListingDurationField,
  isEbayPackageTypeField,
  isEbayShippingTypeField,
} from './approvalFormFieldsEbayHelpers';
import { isImageUrlListField } from './approvalFormFieldsImageHelpers';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { ShopifyTaxonomyTypeSelect } from './ShopifyTaxonomyTypeSelect';
import {
  isCurrencyLikeField,
  isReadOnlyApprovalField,
  isShopifyTypeField,
  normalizeEbayListingDuration,
} from './approvalFormFieldsBasicHelpers';
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
  const isLongText = kind === 'json' || value.length > 120;
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
    const normalizedBooleanValue = value.trim().toLowerCase() === 'true' ? 'true' : 'false';
    return (
      <label className="flex flex-col gap-2">
        {renderFieldLabel(fieldName)}
        <ApprovalSelect
          selectClassName={getSelectClassName(fieldName)}
          value={normalizedBooleanValue}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormValue(fieldName, event.target.value)}
          disabled={inputDisabled}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </ApprovalSelect>
      </label>
    );
  }

  if (dropdownOptions) {
    const optionSet = new Set(dropdownOptions);
    const isShippingTypeDropdown = isEbayShippingTypeField(fieldName);
    const hasMatchingDurationOption = isListingDurationField
      ? optionSet.has(getEbayListingDurationLabel(normalizeEbayListingDuration(value)))
      : false;
    const options = value
      && !optionSet.has(value)
      && !optionSet.has(normalizeEbayListingDuration(value))
      && !hasMatchingDurationOption
      ? [value, ...dropdownOptions]
      : dropdownOptions;
    const normalizedValue = isListingDurationField ? normalizeEbayListingDuration(value) : value;
    const displayValue = isListingDurationField
      ? getEbayListingDurationLabel(normalizedValue)
      : isShippingTypeDropdown
        ? getEbayShippingTypeLabel(normalizedValue)
        : normalizedValue;

    return (
      <label className="flex flex-col gap-2">
        {renderFieldLabel(fieldName)}
        <ApprovalSelect
          selectClassName={getSelectClassName(fieldName)}
          value={displayValue}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const selectedLabel = event.target.value;
            const storeValue = isListingDurationField
              ? normalizeEbayListingDuration(selectedLabel)
              : isShippingTypeDropdown
                ? options.find((option) => getEbayShippingTypeLabel(option) === selectedLabel) ?? selectedLabel
                : selectedLabel;
            setFormValue(fieldName, storeValue);
          }}
          disabled={inputDisabled}
        >
          <option value="">Select an option</option>
          {options.map((option) => (
            <option
              key={option}
              value={isListingDurationField ? getEbayListingDurationLabel(option) : isShippingTypeDropdown ? getEbayShippingTypeLabel(option) : option}
            >
              {isListingDurationField ? getEbayListingDurationLabel(option) : isShippingTypeDropdown ? getEbayShippingTypeLabel(option) : option}
            </option>
          ))}
        </ApprovalSelect>
      </label>
    );
  }

  if (isShopifyTypeField(fieldName)) {
    return (
      <ShopifyTaxonomyTypeSelect
        fieldName={fieldName}
        label={toFieldLabel(fieldName)}
        required={isRequiredField(fieldName)}
        value={value}
        onChange={(nextValue) => setFormValue(fieldName, nextValue)}
        disabled={inputDisabled}
      />
    );
  }

  if (isImageUrlListField(fieldName)) {
    return (
      <ImageUrlListEditor
        fieldLabel={isRequiredField(fieldName) ? `${toFieldLabel(fieldName)} (Required)` : toFieldLabel(fieldName)}
        value={value}
        onChange={(newValue) => setFormValue(fieldName, newValue)}
        disabled={inputDisabled}
      />
    );
  }

  if (isLongText) {
    return (
      <label className="col-span-1 flex flex-col gap-2 md:col-span-2">
        {renderFieldLabel(fieldName)}
        <textarea
          className={getInputClassName(fieldName, 'min-h-[110px] resize-y font-mono leading-[1.4]')}
          value={value}
          onChange={(event) => setFormValue(fieldName, event.target.value)}
          disabled={inputDisabled}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2">
      {renderFieldLabel(fieldName)}
      {isCurrencyLikeField(fieldName) ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]">$</span>
          <input
            className={getInputClassName(fieldName, 'pl-7')}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={value}
            onChange={(event) => setFormValue(fieldName, event.target.value)}
            disabled={inputDisabled}
          />
        </div>
      ) : (
        <input
          className={getInputClassName(fieldName)}
          type={kind === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => setFormValue(fieldName, event.target.value)}
          disabled={inputDisabled}
        />
      )}
    </label>
  );
}