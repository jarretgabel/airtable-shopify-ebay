import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormStandardField } from '@/components/approval/ApprovalFormStandardField';
import {
  renderApprovalFormDropdownField,
  renderApprovalFormTextField,
} from '@/components/approval/approvalFormStandardFieldRenderers';

describe('ApprovalFormStandardField', () => {
  it('shows 1 as the placeholder for an empty quantity field', () => {
    render(
      renderApprovalFormTextField({
        fieldName: 'Quantity',
        kind: 'number',
        value: '',
        formValues: { Quantity: '' },
        inputDisabled: false,
        isRequiredField: () => false,
        renderFieldLabel: (fieldName) => <span>{fieldName}</span>,
        toFieldLabel: (fieldName) => fieldName,
        getSelectClassName: () => 'select',
        getInputClassName: () => 'input',
        setFormValue: vi.fn(),
      }),
    );

    expect(screen.getByPlaceholderText('1')).toHaveAttribute('type', 'number');
    expect(screen.getByPlaceholderText('1')).toHaveAttribute('min', '1');
    expect(screen.getByPlaceholderText('1')).toHaveAttribute('step', '1');
  });

  it('humanizes eBay condition enum labels without changing stored values', () => {
    const setFormValue = vi.fn();

    render(
      renderApprovalFormDropdownField({
        fieldName: 'Condition',
        kind: 'text',
        value: 'USED_VERY_GOOD',
        formValues: { Condition: 'USED_VERY_GOOD' },
        inputDisabled: false,
        dropdownOptions: ['Used', 'NEW', 'USED_VERY_GOOD', 'FOR_PARTS_OR_NOT_WORKING'],
        isRequiredField: () => false,
        renderFieldLabel: (fieldName) => <span>{fieldName}</span>,
        toFieldLabel: (fieldName) => fieldName,
        getSelectClassName: () => 'select',
        getInputClassName: () => 'input',
        setFormValue,
      }),
    );

    expect(screen.getByRole('combobox')).toHaveDisplayValue('Used - Very good');
    expect(screen.getByRole('option', { name: 'New' })).toHaveValue('NEW');
    expect(screen.getByRole('option', { name: 'For parts or not working' })).toHaveValue('FOR_PARTS_OR_NOT_WORKING');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'FOR_PARTS_OR_NOT_WORKING' } });

    expect(setFormValue).toHaveBeenCalledWith('Condition', 'FOR_PARTS_OR_NOT_WORKING');
  });

  it('renders Allow Offers as a yes-no boolean select', () => {
    const setFormValue = vi.fn();

    render(
      <ApprovalFormStandardField
        fieldName="Allow Offers"
        approvalChannel="ebay"
        isCombinedApproval={false}
        allFieldNames={['Allow Offers']}
        hasEbayShippingServicesEditor={false}
        approvedFieldName="Approved"
        hasShopifyTagEditor={false}
        hasShopifyCollectionEditor={false}
        ebayAttributesCandidateFieldNames={[]}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName=""
        useCombinedImageAltEditor={false}
        suppressImageScalarFields
        hasCanonicalConditionField={false}
        testingSectionFieldNames={[]}
        readOnlyFieldNames={[]}
        formValues={{ 'Allow Offers': 'false' }}
        fieldKinds={{ 'Allow Offers': 'text' }}
        saving={false}
        listingFormatOptions={[]}
        listingDurationOptions={[]}
        ebayPackageTypeOptions={[]}
        setFormValue={setFormValue}
        isRequiredField={() => false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        toFieldLabel={(fieldName) => fieldName}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveDisplayValue('No');
    expect(screen.getByRole('option', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'true' } });

    expect(setFormValue).toHaveBeenCalledWith('Allow Offers', 'true');
  });

  it('renders eBay Allow Offers as a yes-no boolean select', () => {
    const setFormValue = vi.fn();

    render(
      <ApprovalFormStandardField
        fieldName="eBay Allow Offers"
        approvalChannel="ebay"
        isCombinedApproval={false}
        allFieldNames={['eBay Allow Offers']}
        hasEbayShippingServicesEditor={false}
        approvedFieldName="Approved"
        hasShopifyTagEditor={false}
        hasShopifyCollectionEditor={false}
        ebayAttributesCandidateFieldNames={[]}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName=""
        useCombinedImageAltEditor={false}
        suppressImageScalarFields
        hasCanonicalConditionField={false}
        testingSectionFieldNames={[]}
        readOnlyFieldNames={[]}
        formValues={{ 'eBay Allow Offers': 'true' }}
        fieldKinds={{ 'eBay Allow Offers': 'text' }}
        saving={false}
        listingFormatOptions={[]}
        listingDurationOptions={[]}
        ebayPackageTypeOptions={[]}
        setFormValue={setFormValue}
        isRequiredField={() => false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        toFieldLabel={(fieldName) => fieldName}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveDisplayValue('Yes');
    expect(screen.getByRole('option', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'false' } });

    expect(setFormValue).toHaveBeenCalledWith('eBay Allow Offers', 'false');
  });

  it('limits title-like text fields to 80 characters', () => {
    render(
      <ApprovalFormStandardField
        fieldName="Item Title"
        approvalChannel="combined"
        isCombinedApproval
        allFieldNames={['Item Title']}
        hasEbayShippingServicesEditor={false}
        approvedFieldName="Approved"
        hasShopifyTagEditor={false}
        hasShopifyCollectionEditor={false}
        ebayAttributesCandidateFieldNames={[]}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName=""
        useCombinedImageAltEditor={false}
        suppressImageScalarFields
        hasCanonicalConditionField={false}
        testingSectionFieldNames={[]}
        readOnlyFieldNames={[]}
        formValues={{ 'Item Title': 'Marantz 2270 - Tv8SETONJoog2c' }}
        fieldKinds={{ 'Item Title': 'text' }}
        saving={false}
        listingFormatOptions={[]}
        listingDurationOptions={[]}
        ebayPackageTypeOptions={[]}
        setFormValue={vi.fn()}
        isRequiredField={() => false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        toFieldLabel={(fieldName) => fieldName}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Item Title' });
    expect(input).toHaveAttribute('maxlength', '80');
  });

  it('shows Pre-Owned placeholder for Shopify condition metafield value field', () => {
    render(
      <ApprovalFormStandardField
        fieldName="Shopify Condition Metafield Value"
        approvalChannel="shopify"
        isCombinedApproval={false}
        allFieldNames={['Shopify Condition Metafield Value']}
        hasEbayShippingServicesEditor={false}
        approvedFieldName="Approved"
        hasShopifyTagEditor={false}
        hasShopifyCollectionEditor={false}
        ebayAttributesCandidateFieldNames={[]}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName=""
        useCombinedImageAltEditor={false}
        suppressImageScalarFields
        hasCanonicalConditionField={false}
        testingSectionFieldNames={[]}
        readOnlyFieldNames={[]}
        formValues={{ 'Shopify Condition Metafield Value': '' }}
        fieldKinds={{ 'Shopify Condition Metafield Value': 'text' }}
        saving={false}
        listingFormatOptions={[]}
        listingDurationOptions={[]}
        ebayPackageTypeOptions={[]}
        setFormValue={vi.fn()}
        isRequiredField={() => false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        toFieldLabel={(fieldName) => fieldName}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.getByPlaceholderText('Pre-Owned')).toBeInTheDocument();
  });

  it('hides Shopify REST Images JSON when workflow image selector is enabled', () => {
    render(
      <ApprovalFormStandardField
        fieldName="Shopify REST Images JSON"
        showWorkflowImageSelector
        approvalChannel="combined"
        isCombinedApproval
        allFieldNames={['Shopify REST Images JSON']}
        hasEbayShippingServicesEditor={false}
        approvedFieldName="Approved"
        hasShopifyTagEditor={false}
        hasShopifyCollectionEditor={false}
        ebayAttributesCandidateFieldNames={[]}
        hasEbayCategoryEditor={false}
        effectiveEbayCategoriesFieldName=""
        useCombinedImageAltEditor={false}
        suppressImageScalarFields
        hasCanonicalConditionField={false}
        testingSectionFieldNames={[]}
        readOnlyFieldNames={[]}
        formValues={{ 'Shopify REST Images JSON': '[{"src":"https://example.com/a.jpg","alt":""}]' }}
        fieldKinds={{ 'Shopify REST Images JSON': 'text' }}
        saving={false}
        listingFormatOptions={[]}
        listingDurationOptions={[]}
        ebayPackageTypeOptions={[]}
        setFormValue={vi.fn()}
        isRequiredField={() => false}
        renderFieldLabel={(fieldName) => <span>{fieldName}</span>}
        toFieldLabel={(fieldName) => fieldName}
        getSelectClassName={() => 'select'}
        getInputClassName={() => 'input'}
      />,
    );

    expect(screen.queryByText('Shopify REST Images JSON')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('https://example.com/image.jpg')).not.toBeInTheDocument();
  });
});