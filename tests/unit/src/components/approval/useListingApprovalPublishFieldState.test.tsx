import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalPublishFieldState } from '@/components/approval/useListingApprovalPublishFieldState';

describe('useListingApprovalPublishFieldState', () => {
  it('prefers Status when present for Shopify listings', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Status', 'Shopify Status'],
      approvalChannel: 'shopify',
      selectedRecord: null,
    }));

    expect(result.current.formatFieldName).toBe('Status');
  });

  it('prefers the eBay listing format field over generic status fields', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Status', 'Ebay Listing Format'],
      approvalChannel: 'ebay',
      selectedRecord: null,
    }));

    expect(result.current.formatFieldName).toBe('Ebay Listing Format');
  });
});
