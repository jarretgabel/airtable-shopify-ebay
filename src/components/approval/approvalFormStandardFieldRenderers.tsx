import { type ChangeEvent, type JSX, useMemo, useState } from 'react';
import { isAllowOffersField } from '@/stores/approvalStore';

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
import { isTitleLikeFieldName } from './listingApprovalFieldHelpers';

const TITLE_FIELD_MAX_LENGTH = 80;

interface ApprovalFormStandardFieldRendererParams {
  fieldName: string;
  kind: 'boolean' | 'number' | 'json' | 'text';
  value: string;
  formValues: Record<string, string>;
  inputDisabled: boolean;
  dropdownOptions?: string[];
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  isRequiredField: (fieldName: string) => boolean;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  toFieldLabel: (fieldName: string) => string;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extra?: string) => string;
  setFormValue: (fieldName: string, value: string) => void;
  isShippingTypeDropdown?: boolean;
  isListingDurationField?: boolean;
}

function parseCurrencyValue(rawValue: string): number | null {
  const cleaned = rawValue.replace(/[^0-9.-]+/g, '').trim();
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCurrencyDisplay(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function resolveIntakeCostValue(formValues: Record<string, string>): number | null {
  const costValue = formValues.Cost ?? formValues['Purchase Price'] ?? '';
  return parseCurrencyValue(costValue);
}

function isEbayListingPriceField(fieldName: string, approvalChannel?: 'shopify' | 'ebay' | 'combined'): boolean {
  const normalized = fieldName.trim().toLowerCase();

  if (normalized === 'price') {
    return approvalChannel === 'ebay';
  }

  return normalized === 'ebay offer price value'
    || normalized === 'ebay offer auction start price value'
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

function isShopifyListingPriceField(fieldName: string, approvalChannel?: 'shopify' | 'ebay' | 'combined'): boolean {
  const normalized = fieldName.trim().toLowerCase();

  if (normalized === 'price') {
    return approvalChannel === 'shopify';
  }

  return normalized === 'shopify rest variant 1 price'
    || normalized === 'shopify variant 1 price'
    || normalized === 'shopify price'
    || normalized === 'shopify_rest_variant_1_price';
}

function PriceFieldWithCalculator({
  fieldName,
  value,
  formValues,
  inputDisabled,
  approvalChannel,
  renderFieldLabel,
  getInputClassName,
  setFormValue,
}: {
  fieldName: string;
  value: string;
  formValues: Record<string, string>;
  inputDisabled: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getInputClassName: (fieldName: string, extra?: string) => string;
  setFormValue: (fieldName: string, value: string) => void;
}): JSX.Element {
  const [percentInput, setPercentInput] = useState('');
  const intakeCost = useMemo(() => resolveIntakeCostValue(formValues), [formValues]);
  const percentValue = useMemo(() => {
    if (!percentInput.trim()) return null;
    const parsed = Number.parseFloat(percentInput);
    return Number.isFinite(parsed) ? parsed : null;
  }, [percentInput]);
  const calculatedPrice = useMemo(() => {
    if (intakeCost == null || percentValue == null) return null;
    return intakeCost * (1 + (percentValue / 100));
  }, [intakeCost, percentValue]);

  const calculatorLabel = isEbayListingPriceField(fieldName, approvalChannel)
    ? 'eBay calculator'
    : 'Shopify calculator';

  return (
    <label className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_170px] md:items-start">
        <div>{renderFieldLabel(fieldName)}</div>
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
          Calculator
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_170px] md:items-start">
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
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)]">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.06em] text-[var(--muted)]">%</span>
            <input
              className="approval-calculator-percent-input w-full bg-transparent text-right text-sm text-[var(--ink)] outline-none"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={percentInput}
              onChange={(event) => setPercentInput(event.target.value)}
              disabled={inputDisabled}
              aria-label={`${calculatorLabel} percent input`}
              placeholder="Add"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-1 md:grid-cols-[minmax(0,1fr)_170px]">
        <p className="m-0 text-xs text-[var(--muted)]">
          Intake cost: {toCurrencyDisplay(intakeCost)}
        </p>
        <p className="m-0 text-xs text-[var(--muted)]">
          Cost + percent: {toCurrencyDisplay(calculatedPrice)}
        </p>
      </div>
    </label>
  );
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
  const booleanLabels = isAllowOffersField(fieldName)
    ? { trueLabel: 'Yes', falseLabel: 'No' }
    : { trueLabel: 'True', falseLabel: 'False' };

  return (
    <label className="flex flex-col gap-2">
      {renderFieldLabel(fieldName)}
      <ApprovalSelect
        selectClassName={getSelectClassName(fieldName)}
        value={normalizedBooleanValue}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => setFormValue(fieldName, event.target.value)}
        disabled={inputDisabled}
      >
        <option value="true">{booleanLabels.trueLabel}</option>
        <option value="false">{booleanLabels.falseLabel}</option>
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
  formValues,
  inputDisabled,
  approvalChannel,
  renderFieldLabel,
  getInputClassName,
  setFormValue,
}: ApprovalFormStandardFieldRendererParams): JSX.Element {
  const inputType = kind === 'number' ? 'number' : 'text';
  const maxLength = inputType === 'text' && isTitleLikeFieldName(fieldName) ? TITLE_FIELD_MAX_LENGTH : undefined;
  const normalizedFieldName = fieldName.trim().toLowerCase();
  const placeholder = normalizedFieldName === 'shopify condition metafield value'
    || normalizedFieldName === 'shopify metafield condition value'
    || normalizedFieldName === 'condition'
    ? 'Pre-Owned'
    : undefined;
  const shouldRenderListingPriceCalculator = isCurrencyLikeField(fieldName)
    && (isEbayListingPriceField(fieldName, approvalChannel) || isShopifyListingPriceField(fieldName, approvalChannel));

  if (shouldRenderListingPriceCalculator) {
    return (
      <PriceFieldWithCalculator
        fieldName={fieldName}
        value={value}
        formValues={formValues}
        inputDisabled={inputDisabled}
        approvalChannel={approvalChannel}
        renderFieldLabel={renderFieldLabel}
        getInputClassName={getInputClassName}
        setFormValue={setFormValue}
      />
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
          type={inputType}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(event) => setFormValue(fieldName, event.target.value)}
          disabled={inputDisabled}
        />
      )}
    </label>
  );
}