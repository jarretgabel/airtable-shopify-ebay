import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedShopifyCollectionSearch,
  getCachedShopifyCollections,
  resetShopifyCollectionsCacheForTests,
  setCachedShopifyCollectionSearch,
  setCachedShopifyCollections,
} from '@/components/approval/shopifyCollectionsCache';

const collections = [
  { id: 'gid://shopify/Collection/1', title: 'Amplifiers', handle: 'amplifiers' },
  { id: 'gid://shopify/Collection/2', title: 'Turntables', handle: 'turntables' },
];

describe('shopifyCollectionsCache', () => {
  beforeEach(() => {
    resetShopifyCollectionsCacheForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
  });

  it('normalizes search keys and reuses cached search results within the ttl', () => {
    setCachedShopifyCollectionSearch('  Amplifiers  ', collections);

    expect(getCachedShopifyCollectionSearch('amplifiers')).toEqual(collections);
    expect(getCachedShopifyCollectionSearch('AMPLIFIERS')).toEqual(collections);
  });

  it('expires cached search results after the ttl window', () => {
    setCachedShopifyCollectionSearch('amplifiers', collections);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getCachedShopifyCollectionSearch('amplifiers')).toBeNull();
  });

  it('reuses and expires the full collections cache independently', () => {
    setCachedShopifyCollections(collections);

    expect(getCachedShopifyCollections()).toEqual(collections);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getCachedShopifyCollections()).toBeNull();
  });
});