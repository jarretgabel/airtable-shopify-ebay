import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalPublishFieldState } from '@/components/approval/useListingApprovalPublishFieldState';

describe('useListingApprovalPublishFieldState', () => {
  it('prefers the current Shopify status field over legacy Shopify status fields', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Status', 'Shopify Status', 'Shopify REST Status'],
      approvalChannel: 'shopify',
      selectedRecord: null,
    }));

    expect(result.current.formatFieldName).toBe('Status');
  });

  it('prefers the current eBay listing format field over the generic legacy status field', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Status', 'Ebay Listing Format'],
      approvalChannel: 'ebay',
      selectedRecord: null,
    }));

    expect(result.current.formatFieldName).toBe('Ebay Listing Format');
  });
});
