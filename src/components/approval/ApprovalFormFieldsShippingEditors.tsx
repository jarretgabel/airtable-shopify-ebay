import { type ChangeEvent } from 'react';

import {
  EBAY_SEPARATED_SHIPPING_FEE_OPTIONS,
  getEbayShippingTypeLabel,
  getSeparatedEbayShippingFeeValue,
} from './approvalFormFieldsEbayHelpers';
import { ApprovalSelect } from './ApprovalSelect';

export interface ApprovalFormFieldsShippingEditorsProps {
  formValues: Record<string, string>;
  setFormValue: (fieldName: string, value: string) => void;
  saving: boolean;
  isReadOnlyApprovalField: (fieldName: string) => boolean;
  renderSpecialLabel: (label: string, fieldName?: string) => JSX.Element;
  renderFieldLabel: (fieldName: string) => JSX.Element;
  getSelectClassName: (fieldName: string) => string;
  getInputClassName: (fieldName: string, extraClassName?: string) => string;
  ebayDomesticShippingFeesFieldName?: string;
  ebayInternationalShippingFeesFieldName?: string;
  ebayDomesticShippingFlatFeeFieldName: string;
  ebayInternationalShippingFlatFeeFieldName: string;
}

export function ApprovalFormFieldsShippingEditors({
  formValues,
  setFormValue,
  saving,
  isReadOnlyApprovalField,
  renderSpecialLabel,
  renderFieldLabel,
  getSelectClassName,
  getInputClassName,
  ebayDomesticShippingFeesFieldName,
  ebayInternationalShippingFeesFieldName,
  ebayDomesticShippingFlatFeeFieldName,
  ebayInternationalShippingFlatFeeFieldName,
}: ApprovalFormFieldsShippingEditorsProps) {
  function renderShippingFlatFeeInput(fieldName: string, label: string) {
    const value = formValues[fieldName] ?? '';

    return (
      <label className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white/5 p-3">
        {renderSpecialLabel(label, fieldName.startsWith('__') ? undefined : fieldName)}
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
            disabled={saving}
          />
        </div>
      </label>
    );
  }

  function renderShippingFeeSelectField(params: {
    fieldName: string;
    selectedValue: string;
    inputDisabled: boolean;
    isInternational: boolean;
  }) {
    const { fieldName, selectedValue, inputDisabled, isInternational } = params;

    return (
      <label key={fieldName} className="flex flex-col gap-2">
        {renderFieldLabel(fieldName)}
        <ApprovalSelect
          selectClassName={getSelectClassName(fieldName)}
          value={selectedValue}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const nextSelectedValue = event.target.value;
            const domesticFieldName = ebayDomesticShippingFeesFieldName ?? fieldName;
            const internationalFieldName = ebayInternationalShippingFeesFieldName;
            const domesticStoredValue = formValues[domesticFieldName] ?? '';
            const internationalStoredValue = internationalFieldName ? (formValues[internationalFieldName] ?? '') : '';
            const nextDomesticValue = isInternational
              ? getSeparatedEbayShippingFeeValue({
                  fieldName: domesticFieldName,
                  fieldValue: domesticStoredValue,
                  domesticFieldValue: domesticStoredValue,
                })
              : nextSelectedValue;
            const nextInternationalValue = isInternational
              ? nextSelectedValue
              : getSeparatedEbayShippingFeeValue({
                  fieldName: internationalFieldName ?? fieldName,
                  fieldValue: internationalStoredValue,
                  domesticFieldValue: domesticStoredValue,
                });

            if (domesticFieldName) {
              setFormValue(domesticFieldName, nextDomesticValue);
            }

            if (internationalFieldName) {
              setFormValue(internationalFieldName, nextInternationalValue);
            }
          }}
          disabled={inputDisabled}
        >
          <option value="">Select an option</option>
          {EBAY_SEPARATED_SHIPPING_FEE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {getEbayShippingTypeLabel(option)}
            </option>
          ))}
        </ApprovalSelect>
        {!isInternational && selectedValue === 'Flat'
          ? renderShippingFlatFeeInput(ebayDomesticShippingFlatFeeFieldName, 'eBay Domestic Shipping Flat Fee')
          : null}
        {isInternational && selectedValue === 'Flat'
          ? renderShippingFlatFeeInput(ebayInternationalShippingFlatFeeFieldName, 'eBay International Shipping Flat Fee')
          : null}
      </label>
    );
  }

  if (!ebayDomesticShippingFeesFieldName && !ebayInternationalShippingFeesFieldName) return null;

  const domesticFieldName = ebayDomesticShippingFeesFieldName ?? 'eBay Domestic Shipping Fees';
  const internationalFieldName = ebayInternationalShippingFeesFieldName ?? 'eBay International Shipping Fees';
  const domesticStoredValue = ebayDomesticShippingFeesFieldName ? (formValues[ebayDomesticShippingFeesFieldName] ?? '') : '';
  const internationalStoredValue = ebayInternationalShippingFeesFieldName ? (formValues[ebayInternationalShippingFeesFieldName] ?? '') : '';
  const domesticSelectedValue = getSeparatedEbayShippingFeeValue({
    fieldName: domesticFieldName,
    fieldValue: domesticStoredValue,
  });
  const internationalSelectedValue = getSeparatedEbayShippingFeeValue({
    fieldName: internationalFieldName,
    fieldValue: internationalStoredValue,
    domesticFieldValue: domesticStoredValue,
  });
  const domesticDisabled = saving || isReadOnlyApprovalField(domesticFieldName);
  const internationalDisabled = saving || isReadOnlyApprovalField(internationalFieldName);

  return (
    <div className="col-span-1 grid grid-cols-1 gap-4 md:col-span-2 md:grid-cols-2">
      {renderShippingFeeSelectField({
        fieldName: domesticFieldName,
        selectedValue: domesticSelectedValue,
        inputDisabled: domesticDisabled,
        isInternational: false,
      })}
      {renderShippingFeeSelectField({
        fieldName: internationalFieldName,
        selectedValue: internationalSelectedValue,
        inputDisabled: internationalDisabled,
        isInternational: true,
      })}
    </div>
  );
}