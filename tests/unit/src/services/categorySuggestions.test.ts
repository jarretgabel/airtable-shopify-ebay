import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateListingCategoryQueries = vi.fn();
const pickListingCategory = vi.fn();
const pickListingCollections = vi.fn();
const getCollections = vi.fn();
const searchEbayCategorySuggestions = vi.fn();
const searchTaxonomyCategories = vi.fn();

vi.mock('@/services/app-api/ai', () => ({ generateListingCategoryQueries, pickListingCategory, pickListingCollections }));
vi.mock('@/services/app-api/ebay', () => ({ searchEbayCategorySuggestions }));
vi.mock('@/services/app-api/shopify', () => ({ searchTaxonomyCategories, getCollections }));

const { suggestEbayCategory, suggestShopifyCategory, suggestShopifyCollections } = await import('@/services/categorySuggestions');
const { resetShopifyCollectionsCacheForTests } = await import('@/components/approval/shopifyCollectionsCache');

describe('categorySuggestions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetShopifyCollectionsCacheForTests();
  });

  it('searches Shopify taxonomy with the AI phrases and returns the picked category', async () => {
    generateListingCategoryQueries.mockResolvedValue(['tube amplifier', 'amplifier']);
    searchTaxonomyCategories.mockImplementation(async (query: string) => (
      query === 'tube amplifier'
        ? [{ id: 'gid://shopify/TaxonomyCategory/a', fullName: 'Electronics > Audio > Amplifiers' }]
        : [{ id: 'gid://shopify/TaxonomyCategory/a', fullName: 'Electronics > Audio > Amplifiers' }, { id: 'gid://shopify/TaxonomyCategory/b', fullName: 'Electronics > Audio' }]
    ));
    pickListingCategory.mockResolvedValue('gid://shopify/TaxonomyCategory/a');

    const result = await suggestShopifyCategory({ Make: 'Leben' });

    expect(result).toEqual({ id: 'gid://shopify/TaxonomyCategory/a', label: 'Electronics > Audio > Amplifiers' });
    expect(pickListingCategory).toHaveBeenCalledWith('shopify', { Make: 'Leben' }, [
      { id: 'gid://shopify/TaxonomyCategory/a', label: 'Electronics > Audio > Amplifiers' },
      { id: 'gid://shopify/TaxonomyCategory/b', label: 'Electronics > Audio' },
    ]);
  });

  it('returns null when the AI picks nothing from the eBay candidates', async () => {
    generateListingCategoryQueries.mockResolvedValue(['interconnect cable']);
    searchEbayCategorySuggestions.mockResolvedValue([{ id: '1', name: 'Cables', path: 'Audio > Cables', level: 2 }]);
    pickListingCategory.mockResolvedValue(null);

    expect(await suggestEbayCategory({ Make: 'MIT' }, 'EBAY_US')).toBeNull();
    expect(searchEbayCategorySuggestions).toHaveBeenCalledWith('interconnect cable', 'EBAY_US');
  });

  it('keeps going when one search fails', async () => {
    generateListingCategoryQueries.mockResolvedValue(['bad', 'good']);
    searchEbayCategorySuggestions.mockImplementation(async (query: string) => {
      if (query === 'bad') throw new Error('boom');
      return [{ id: '2', name: 'Amplifiers', path: 'Audio > Amplifiers', level: 2 }];
    });
    pickListingCategory.mockResolvedValue('2');

    expect(await suggestEbayCategory({ Make: 'Leben' })).toEqual({ id: '2', label: 'Audio > Amplifiers' });
  });

  it('retries with single words when the phrases find nothing', async () => {
    generateListingCategoryQueries.mockResolvedValue(['interconnect audio cable']);
    searchEbayCategorySuggestions.mockImplementation(async (query: string) => (
      query === 'cable' || query === 'audio' ? [{ id: '7', name: 'Cables', path: 'Audio > Cables', level: 2 }] : []
    ));
    pickListingCategory.mockResolvedValue('7');

    expect(await suggestEbayCategory({ Make: 'MIT' })).toEqual({ id: '7', label: 'Audio > Cables' });
  });

  it('surfaces the search error when every search fails', async () => {
    generateListingCategoryQueries.mockResolvedValue(['amplifier']);
    searchTaxonomyCategories.mockRejectedValue(new Error('Shopify unavailable'));

    await expect(suggestShopifyCategory({ Make: 'Leben' })).rejects.toThrow('Shopify unavailable');
    expect(pickListingCategory).not.toHaveBeenCalled();
  });

  it('offers only manual collections to the AI and returns the picked ones', async () => {
    getCollections.mockResolvedValue([
      { id: 'gid://shopify/Collection/1', title: 'Amplifiers', handle: 'amps' },
      { id: 'gid://shopify/Collection/2', title: 'Under $500', handle: 'under-500', isSmartCollection: true },
      { id: 'gid://shopify/Collection/3', title: 'Cables', handle: 'cables' },
    ]);
    pickListingCollections.mockResolvedValue(['gid://shopify/Collection/3']);

    const result = await suggestShopifyCollections({ Make: 'MIT' });

    expect(pickListingCollections).toHaveBeenCalledWith({ Make: 'MIT' }, [
      { id: 'gid://shopify/Collection/1', label: 'Amplifiers' },
      { id: 'gid://shopify/Collection/3', label: 'Cables' },
    ]);
    expect(result).toEqual([{ id: 'gid://shopify/Collection/3', label: 'Cables' }]);
  });
});
