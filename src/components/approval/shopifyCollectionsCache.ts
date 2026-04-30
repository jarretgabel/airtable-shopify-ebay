import type { ShopifyCollectionMatch } from '@/services/shopify';

const SHOPIFY_COLLECTIONS_CACHE_TTL_MS = 5 * 60 * 1000;

interface ShopifyCollectionsCacheEntry {
  collections: ShopifyCollectionMatch[];
  loadedAt: number;
}

let fullCollectionsCache: ShopifyCollectionsCacheEntry | null = null;
const searchCollectionsCache = new Map<string, ShopifyCollectionsCacheEntry>();

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function isFresh(entry: ShopifyCollectionsCacheEntry | null): entry is ShopifyCollectionsCacheEntry {
  if (!entry) return false;
  return Date.now() - entry.loadedAt <= SHOPIFY_COLLECTIONS_CACHE_TTL_MS;
}

export function getCachedShopifyCollections(): ShopifyCollectionMatch[] | null {
  if (!isFresh(fullCollectionsCache)) {
    fullCollectionsCache = null;
    return null;
  }

  return fullCollectionsCache.collections;
}

export function setCachedShopifyCollections(collections: ShopifyCollectionMatch[]): void {
  fullCollectionsCache = {
    collections,
    loadedAt: Date.now(),
  };
}

export function getCachedShopifyCollectionSearch(query: string): ShopifyCollectionMatch[] | null {
  const normalized = normalizeQuery(query);
  const cached = searchCollectionsCache.get(normalized) ?? null;
  if (!isFresh(cached)) {
    searchCollectionsCache.delete(normalized);
    return null;
  }

  return cached.collections;
}

export function setCachedShopifyCollectionSearch(query: string, collections: ShopifyCollectionMatch[]): void {
  searchCollectionsCache.set(normalizeQuery(query), {
    collections,
    loadedAt: Date.now(),
  });
}

export function resetShopifyCollectionsCacheForTests(): void {
  fullCollectionsCache = null;
  searchCollectionsCache.clear();
}