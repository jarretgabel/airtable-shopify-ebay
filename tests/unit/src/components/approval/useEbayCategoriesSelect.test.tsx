import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEbayCategory } from '@/services/app-api/ebay';
import { useEbayCategoriesSelect } from '../../../../../src/components/approval/useEbayCategoriesSelect';

vi.mock('@/services/app-api/ebay', () => ({
  getEbayCategory: vi.fn(),
  getEbayChildCategories: vi.fn(),
  getEbayRootCategories: vi.fn(),
  searchEbayCategorySuggestions: vi.fn(),
}));

describe('useEbayCategoriesSelect', () => {
  beforeEach(() => {
    vi.mocked(getEbayCategory).mockReset();
  });

  it('resolves a persisted category ID to its display name', async () => {
    vi.mocked(getEbayCategory).mockResolvedValue({
      id: '852',
      name: 'DVDs & Blu-ray Discs',
      path: 'Movies & TV > DVDs & Blu-ray Discs',
      level: 2,
      hasChildren: false,
    });

    const { result } = renderHook(() => useEbayCategoriesSelect({
      marketplaceId: 'EBAY_US',
      value: ['852'],
      labelsById: {},
      disabled: false,
      onChange: vi.fn(),
    }));

    await waitFor(() => {
      expect(result.current.categoryMap.get('852')?.name).toBe('DVDs & Blu-ray Discs');
    });

    expect(getEbayCategory).toHaveBeenCalledWith('852', 'EBAY_US');
  });
});
