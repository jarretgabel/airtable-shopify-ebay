import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalFormStandardField } from '@/components/approval/ApprovalFormStandardField';

describe('ApprovalFormStandardField', () => {
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
});