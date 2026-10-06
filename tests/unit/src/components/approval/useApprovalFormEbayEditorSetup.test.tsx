import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApprovalFormEbayEditorSetup } from '@/components/approval/useApprovalFormEbayEditorSetup';
import {
  SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD,
  SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD,
} from '@/components/approval/approvalFormFieldsEbayHelpers';

vi.mock('@/services/app-api/ebay', () => ({
  getEbayPackageTypes: vi.fn(async () => []),
}));

describe('useApprovalFormEbayEditorSetup', () => {
  it('defaults an empty eBay condition to Used', () => {
    const setDerivedFormValue = vi.fn();

    renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-condition-default',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['Condition'],
      writableFieldNames: ['Condition'],
      formValues: {},
      originalFieldValues: {},
      setFormValue: vi.fn(),
      setDerivedFormValue,
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(setDerivedFormValue).toHaveBeenCalledWith('__Condition__', 'Used');
  });

  it('preserves an existing eBay condition instead of applying the default', () => {
    const setDerivedFormValue = vi.fn();

    renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-condition-existing',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['Condition'],
      writableFieldNames: ['Condition'],
      formValues: {},
      originalFieldValues: { Condition: 'USED_GOOD' },
      setFormValue: vi.fn(),
      setDerivedFormValue,
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(setDerivedFormValue).not.toHaveBeenCalledWith('__Condition__', 'Used');
  });

  it('keeps eBay aspects fields hidden without exposing an attributes editor', () => {
    const setFormValue = vi.fn();
    const setDerivedFormValue = vi.fn();

    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-approval',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: [
        'Title',
        'eBay Inventory Product Aspects JSON',
        'eBay Inventory Product Aspects',
      ],
      writableFieldNames: [
        'Title',
        'eBay Inventory Product Aspects JSON',
        'eBay Inventory Product Aspects',
      ],
      formValues: {
        Title: 'McIntosh MC2105',
        'eBay Inventory Product Aspects JSON': JSON.stringify([{ name: 'Brand', values: ['McIntosh'] }]),
      },
      originalFieldValues: { Condition: 'USED_GOOD' },
      setFormValue,
      setDerivedFormValue,
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.ebayAttributesCandidateFieldNames).toEqual([
      'eBay Inventory Product Aspects JSON',
      'eBay Inventory Product Aspects',
    ]);
    expect(result.current.ebayAttributesFieldName).toBeUndefined();
    expect(result.current.ebayAttributesSyncFieldNames).toEqual([]);
  });

  it('does not inject a selected template id into a blank persisted field', () => {
    const setFormValue = vi.fn();
    const setDerivedFormValue = vi.fn();

    renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-template',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['eBay Body HTML Template'],
      writableFieldNames: ['eBay Body HTML Template'],
      formValues: {
        'eBay Body HTML Template': '',
      },
      originalFieldValues: { Condition: 'USED_GOOD' },
      setFormValue,
      setDerivedFormValue,
      selectedEbayTemplateId: 'impact-luxe',
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(setDerivedFormValue).not.toHaveBeenCalled();
    expect(setFormValue).not.toHaveBeenCalled();
  });

  it('does not resolve synthetic flat-fee form values as writable Airtable fields', () => {
    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-shipping',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['Ebay Domestic Shipping Fees', 'Ebay International Shipping Fees'],
      writableFieldNames: ['Ebay Domestic Shipping Fees', 'Ebay International Shipping Fees'],
      formValues: {
        'Ebay Domestic Shipping Fees': 'Calculated',
        'Ebay International Shipping Fees': 'Flat',
        [SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD]: '',
        [SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD]: '',
      },
      originalFieldValues: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.ebayDomesticShippingFlatFeeFieldName).toBe(SYNTHETIC_EBAY_DOMESTIC_SHIPPING_FLAT_FEE_FIELD);
    expect(result.current.ebayInternationalShippingFlatFeeFieldName).toBe(SYNTHETIC_EBAY_INTERNATIONAL_SHIPPING_FLAT_FEE_FIELD);
  });

  it('binds singular international service fields to the shipping services editor', () => {
    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-international-service',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['Domestic Service', 'International Service'],
      writableFieldNames: ['Domestic Service', 'International Service'],
      formValues: {
        'Domestic Service': '',
        'International Service': '',
      },
      originalFieldValues: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.hasEbayShippingServicesEditor).toBe(true);
    expect(result.current.domesticService1FieldName).toBe('Domestic Service');
    expect(result.current.internationalService1FieldName).toBe('International Service');
  });

  it('provides an international service slot when Airtable omits the blank field', () => {
    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-ebay-missing-international-service',
      approvalChannel: 'ebay',
      isCombinedApproval: false,
      allFieldNames: ['Ebay Domestic Service'],
      writableFieldNames: ['Ebay Domestic Service'],
      formValues: { 'Ebay Domestic Service': '' },
      originalFieldValues: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.hasEbayShippingServicesEditor).toBe(true);
    expect(result.current.internationalService1FieldName).toBe('International Service');
  });

  it('enables the shipping services editor in combined approvals', () => {
    const { result } = renderHook(() => useApprovalFormEbayEditorSetup({
      recordId: 'rec-combined-ebay-services',
      approvalChannel: 'ebay',
      isCombinedApproval: true,
      allFieldNames: ['Ebay Domestic Service'],
      writableFieldNames: ['Ebay Domestic Service'],
      formValues: { 'Ebay Domestic Service': '' },
      originalFieldValues: {},
      setFormValue: vi.fn(),
      setDerivedFormValue: vi.fn(),
      selectedEbayTemplateId: undefined,
      onEbayTemplateIdChange: undefined,
      ebayMarketplaceId: 'EBAY_US',
      isEbayListingForm: true,
    }));

    expect(result.current.hasEbayShippingServicesEditor).toBe(true);
    expect(result.current.internationalService1FieldName).toBe('International Service');
  });
});
