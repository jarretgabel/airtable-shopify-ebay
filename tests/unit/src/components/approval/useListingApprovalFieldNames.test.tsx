import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalFieldNames } from '@/components/approval/useListingApprovalFieldNames';

describe('useListingApprovalFieldNames', () => {
  it('includes writable flat-fee fields when Airtable omits blank values from records', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{
        fields: {
          'Ebay Domestic Shipping Fees': 'Calculated',
          'Ebay International Shipping Fees': 'Flat',
        },
      }],
      approvalChannel: 'ebay',
    }));

    expect(result.current.allFieldNames).toContain('eBay Domestic Shipping Flat Fee');
    expect(result.current.allFieldNames).toContain('eBay International Shipping Flat Fee');
    expect(result.current.allFieldNames).not.toContain('Shopify Body Key Features JSON');
  });

  it('retains real flat-fee fields returned by Airtable', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{
        fields: {
          'Ebay Domestic Shipping Fees': 'Flat',
          'eBay Domestic Shipping Flat Fee': 200,
        },
      }],
      approvalChannel: 'ebay',
    }));

    expect(result.current.allFieldNames).toContain('eBay Domestic Shipping Flat Fee');
  });

  it('includes the writable domestic service field when Airtable omits its blank value', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{
        fields: {
          'Ebay International Service 1': 'International',
        },
      }],
      approvalChannel: 'combined',
    }));

    expect(result.current.allFieldNames).toContain('Ebay Domestic Service 1');
    expect(result.current.allFieldNames).toContain('Ebay International Service 1');
  });

  it('includes the canonical Description field when Airtable omits its blank value', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{ fields: { Title: 'MIT MITerminator 2' } }],
      approvalChannel: 'combined',
    }));

    expect(result.current.allFieldNames).toContain('Description');
  });

  it('retains an existing description alias without adding a duplicate canonical field', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{ fields: { 'Item Description': 'Existing description' } }],
      approvalChannel: 'combined',
    }));

    expect(result.current.allFieldNames).toContain('Item Description');
    expect(result.current.allFieldNames).not.toContain('Description');
  });
});