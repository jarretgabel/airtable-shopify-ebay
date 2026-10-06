import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useApprovalFormShopifyCollectionsSetup } from '@/components/approval/useApprovalFormShopifyCollectionsSetup';

describe('useApprovalFormShopifyCollectionsSetup', () => {
  it('uses hydrated Airtable collections while the normalized preview is empty', () => {
    const { result } = renderHook(() => useApprovalFormShopifyCollectionsSetup({
      recordId: 'rec-collections',
      forceShowShopifyCollectionsEditor: true,
      allFieldNames: ['Shopify Collections'],
      writableFieldNames: ['Shopify Collections'],
      formValues: {
        'Shopify Collections': '["gid://shopify/Collection/486947422530"]',
      },
      fieldKinds: {
        'Shopify Collections': 'json',
      },
      normalizedShopifyCollectionIds: [],
      normalizedShopifyCollectionLabelsById: {},
      setFormValue: vi.fn(),
    }));

    expect(result.current.effectiveShopifyCollectionIds).toEqual([
      'gid://shopify/Collection/486947422530',
    ]);
  });
});