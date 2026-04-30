import { type ChangeEvent, type JSX } from 'react';

import { ApprovalSelect } from './ApprovalSelect';
import {
  isCurrencyLikeField,
  normalizeEbayListingDuration,
} from './approvalFormFieldsEbayHelpersBasic';
import {
  getEbayListingDurationLabel,
  getEbayShippingTypeLabel,
} from './approvalFormFieldsEbayHelpers';
import { isImageUrlListField } from './approvalFormFieldsImageHelpers';
import { ImageUrlListEditor } from './ImageUrlListEditor';
import { isShopifyTypeField } from './approvalFormFieldsShopifyHelpersBasic';
import { ShopifyTaxonomyTypeSelect } from './ShopifyTaxonomyTypeSelect';

interface ApprovalFormStandardFieldRendererParams {
  fieldName: string;
  kind: 'boolean' | 'number' | 'json' | 'text';
  value: string;
  inputDisabled: boolean;
  dropdownOptions?: string[];
  isRequiredField: (fieldName: string) => boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  toFieldLabel: (fieldName: string) => string;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extra?: string) => string;
  setFormValue: (fieldName: string, value: string) => void;
  isShippingTypeDropdown?: boolean;
  isListingDurationField?: boolean;
}

export function renderApprovalFormBooleanField({
  fieldName,
  value,
  inputDisabled,
  renderFieldLabel,
  getSelectClassName,
  setFormValue,
}: ApprovalFormStandardFieldRendererParams): JSX.Element {
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

export function renderApprovalFormDropdownField({
  fieldName,
  value,
  inputDisabled,
  dropdownOptions,
  renderFieldLabel,
  getSelectClassName,
  setFormValue,
  isShippingTypeDropdown = false,
  isListingDurationField = false,
}: ApprovalFormStandardFieldRendererParams): JSX.Element {
  const availableOptions = dropdownOptions ?? [];
  const optionSet = new Set(availableOptions);
  const hasMatchingDurationOption = isListingDurationField
    ? optionSet.has(getEbayListingDurationLabel(normalizeEbayListingDuration(value)))
    : false;
  const options = value
    && !optionSet.has(value)
    && !optionSet.has(normalizeEbayListingDuration(value))
    && !hasMatchingDurationOption
    ? [value, ...availableOptions]
    : availableOptions;
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
        {options.map((option) => {
          const optionLabel = isListingDurationField
            ? getEbayListingDurationLabel(option)
            : isShippingTypeDropdown
              ? getEbayShippingTypeLabel(option)
              : option;

          return (
            <option key={option} value={optionLabel}>
              {optionLabel}
            </option>
          );
        })}
      </ApprovalSelect>
    </label>
  );
}

export function renderApprovalFormSpecialField({
  fieldName,
  kind,
  value,
  inputDisabled,
  isRequiredField,
  renderFieldLabel,
  toFieldLabel,
  getInputClassName,
  setFormValue,
}: ApprovalFormStandardFieldRendererParams): JSX.Element | null {
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

  const isLongText = kind === 'json' || value.length > 120;
  if (!isLongText) return null;

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

export function renderApprovalFormTextField({
  fieldName,
  kind,
  value,
  inputDisabled,
  renderFieldLabel,
  getInputClassName,
  setFormValue,
}: ApprovalFormStandardFieldRendererParams): JSX.Element {
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