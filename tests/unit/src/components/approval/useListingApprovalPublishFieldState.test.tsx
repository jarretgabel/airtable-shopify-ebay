import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useListingApprovalPublishFieldState } from '@/components/approval/useListingApprovalPublishFieldState';

describe('useListingApprovalPublishFieldState', () => {
  it('does not use a compare-at price as the single-channel sale price', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Shopify REST Variant 1 Compare At Price'],
      approvalChannel: 'shopify',
      selectedRecord: null,
    }));

    expect(result.current.priceFieldName).toBe('');
  });

  it('recognizes canonical Shopify Price for single-channel and required-field validation', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: ['Item Title', 'Shopify Price', 'Ebay Price'],
      approvalChannel: 'shopify',
      selectedRecord: null,
    }));

    expect(result.current.priceFieldName).toBe('Shopify Price');
    expect(result.current.shopifyRequiredFieldNames).toContain('Shopify Price');
    expect(result.current.shopifyRequiredFieldNames).not.toContain('Ebay Price');
  });

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

  it('requires SKU, title, description, condition, price, and category before eBay publish', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: [
        'eBay Inventory SKU',
        'Item Title',
        'Description',
        'Item Condition',
        'Ebay Listing Format',
        'Buy It Now USD',
        'Categories',
      ],
      approvalChannel: 'ebay',
      selectedRecord: null,
    }));

    expect(result.current.ebayRequiredFieldNames).toEqual([
      'eBay Inventory SKU',
      'Item Title',
      'Description',
      'Item Condition',
      'Ebay Listing Format',
      'Buy It Now USD',
      'Categories',
    ]);
  });

  it('keeps category required when it is not included in the record field projection', () => {
    const { result } = renderHook(() => useListingApprovalPublishFieldState({
      allFieldNames: [
        'eBay Inventory SKU',
        'Item Title',
        'Description',
        'Item Condition',
        'Buy It Now USD',
      ],
      approvalChannel: 'ebay',
      selectedRecord: null,
    }));

    expect(result.current.ebayRequiredFieldNames).toContain('Ebay Categories');
  });
});
