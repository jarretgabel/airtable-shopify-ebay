import { useMemo } from 'react';
import type { ShopifyProduct } from '@/types/shopify';

interface ShopifyApprovalPreviewSnapshot {
  collectionIds: string[];
  effectiveProduct: ShopifyProduct;
  resolvedCategoryId?: string;
}

interface UseListingApprovalShopifyPreviewSupportParams {
  loadShopifyApprovalPreviewNow: (fields: Record<string, unknown>) => Promise<{
    collectionIds: string[];
    effectiveProduct: ShopifyProduct;
    resolvedCategoryId?: string;
  }>;
  shopifyApprovalPreview: {
    collectionIds: string[];
    effectiveProduct: ShopifyProduct;
    resolvedCategoryId?: string;
  } | null;
}

export function useListingApprovalShopifyPreviewSupport({
  loadShopifyApprovalPreviewNow,
  shopifyApprovalPreview,
}: UseListingApprovalShopifyPreviewSupportParams) {
  const shopifyApprovalPreviewSnapshot = useMemo<ShopifyApprovalPreviewSnapshot | null>(
    () => (shopifyApprovalPreview
      ? {
        effectiveProduct: shopifyApprovalPreview.effectiveProduct,
        collectionIds: shopifyApprovalPreview.collectionIds,
        resolvedCategoryId: shopifyApprovalPreview.resolvedCategoryId,
      }
      : null),
    [shopifyApprovalPreview],
  );

  const loadShopifyApprovalPreviewSnapshotNow = async (fields: Record<string, unknown>): Promise<ShopifyApprovalPreviewSnapshot> => {
    const preview = await loadShopifyApprovalPreviewNow(fields);
    return {
      effectiveProduct: preview.effectiveProduct,
      collectionIds: preview.collectionIds,
      resolvedCategoryId: preview.resolvedCategoryId,
    };
  };

  return {
    loadShopifyApprovalPreviewSnapshotNow,
    shopifyApprovalPreviewSnapshot,
  };
}