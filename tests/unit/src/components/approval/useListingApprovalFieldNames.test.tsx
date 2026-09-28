import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalFieldNames } from '@/components/approval/useListingApprovalFieldNames';

describe('useListingApprovalFieldNames', () => {
  it('does not invent flat-fee fields that are absent from Airtable records', () => {
    const { result } = renderHook(() => useListingApprovalFieldNames({
      records: [{
        fields: {
          'Ebay Domestic Shipping Fees': 'Calculated',
          'Ebay International Shipping Fees': 'Flat',
        },
      }],
      approvalChannel: 'ebay',
    }));

    expect(result.current.allFieldNames).not.toContain('eBay Domestic Shipping Flat Fee');
    expect(result.current.allFieldNames).not.toContain('eBay International Shipping Flat Fee');
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
});