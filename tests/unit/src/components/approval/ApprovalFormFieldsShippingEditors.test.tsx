import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormFieldsShippingEditors } from '@/components/approval/ApprovalFormFieldsShippingEditors';
import {
  SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD,
  SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD,
} from '@/components/approval/approvalFormFieldsEbayHelpers';

describe('ApprovalFormFieldsShippingEditors', () => {
  it('writes domestic and international choices to their real Airtable fields', () => {
    const setFormValue = vi.fn();
    render(
      <ApprovalFormFieldsShippingEditors
        formValues={{}}
        setFormValue={setFormValue}
        saving={false}
        isReadOnlyApprovalField={() => false}
        renderSpecialLabel={(label) => <span>{label}</span>}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
        ebayDomesticShippingFeesFieldName="Ebay Domestic Shipping Fees"
        ebayInternationalShippingFeesFieldName="Ebay International Shipping Fees"
        ebayDomesticShippingFlatFeeFieldName={SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD}
        ebayInternationalShippingFlatFeeFieldName={SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD}
      />,
    );

    fireEvent.change(screen.getByLabelText('Ebay Domestic Shipping Fees'), { target: { value: 'Calculated' } });
    fireEvent.change(screen.getByLabelText('Ebay International Shipping Fees'), { target: { value: 'Flat' } });

    expect(setFormValue).toHaveBeenCalledWith('Ebay Domestic Shipping Fees', 'Calculated');
    expect(setFormValue).toHaveBeenCalledWith('Ebay International Shipping Fees', 'Flat');
    expect(setFormValue).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('eBay International Shipping Flat Fee')).not.toBeInTheDocument();
  });
});