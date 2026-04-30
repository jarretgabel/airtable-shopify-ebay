import { useState, useEffect, useCallback } from 'react';
import { TAB_DATA_TTLS, shouldReuseTabData } from '@/app/tabDataCache';
import { getProducts } from '@/services/app-api/shopify';
import type { ShopifyProduct } from '@/types/shopify';

type ShopifyProductFull = ShopifyProduct & { id: number; created_at: string; updated_at: string };

interface UseShopifyProductsResult {
  products: ShopifyProductFull[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useShopifyProducts(enabled = true): UseShopifyProductsResult {
  const [products, setProducts] = useState<ShopifyProductFull[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const fetchProducts = useCallback(async (force = true) => {
    if (!force && shouldReuseTabData(lastLoadedAt, TAB_DATA_TTLS.shopifyProducts, error === null)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getProducts(250);
      setProducts(data as ShopifyProductFull[]);
      setLastLoadedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [error, lastLoadedAt]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    void fetchProducts(false);
  }, [enabled, fetchProducts]);

  return { products, loading, error, refetch: () => { void fetchProducts(true); } };
}
