import { useState, useEffect, useCallback } from 'react';
import { shopifyService } from '@/services/shopify';
import type { ShopifyProduct } from '@/types/shopify';

type ShopifyProductFull = ShopifyProduct & { id: number; created_at: string; updated_at: string };

interface UseShopifyProductsResult {
  products: ShopifyProductFull[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useShopifyProducts(): UseShopifyProductsResult {
  const [products, setProducts] = useState<ShopifyProductFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopifyService.getProducts(250);
      setProducts(data as ShopifyProductFull[]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
