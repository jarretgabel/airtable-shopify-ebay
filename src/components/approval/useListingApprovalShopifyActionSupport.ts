import { useListingApprovalShopifyPreviewSupport } from '@/components/approval/useListingApprovalShopifyPreviewSupport';
import { useListingApprovalShopifySupport } from '@/components/approval/useListingApprovalShopifySupport';
import type { InlineNoticeTone } from '@/components/approval/listingApprovalRecordActionTypes';
import type { ShopifyProduct } from '@/types/shopify';

interface ShopifyApprovalPreviewSummary {
  collectionIds: string[];
  effectiveProduct: ShopifyProduct;
  resolvedCategoryId?: string;
}

interface UseListingApprovalShopifyActionSupportParams {
  currentPageCategoryIdValue: string;
  loadShopifyApprovalPreviewNow: (fields: Record<string, unknown>) => Promise<ShopifyApprovalPreviewSummary>;
  pushInlineActionNotice: (tone: InlineNoticeTone, title: string, message: string) => void;
  shopifyApprovalPreview: ShopifyApprovalPreviewSummary | null;
}

export function useListingApprovalShopifyActionSupport({
  currentPageCategoryIdValue,
  loadShopifyApprovalPreviewNow,
  pushInlineActionNotice,
  shopifyApprovalPreview,
}: UseListingApprovalShopifyActionSupportParams) {
  const {
    loadShopifyApprovalPreviewSnapshotNow,
    shopifyApprovalPreviewSnapshot,
  } = useListingApprovalShopifyPreviewSupport({
    loadShopifyApprovalPreviewNow,
    shopifyApprovalPreview,
  });

  const {
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
  } = useListingApprovalShopifySupport({
    currentPageCategoryIdValue,
    loadShopifyApprovalPreviewNow: loadShopifyApprovalPreviewSnapshotNow,
    pushInlineActionNotice,
    shopifyApprovalPreview: shopifyApprovalPreviewSnapshot,
    shopifyResolvedCategoryId: shopifyApprovalPreview?.resolvedCategoryId,
  });

  return {
    describeShopifyCreateError,
    loadShopifyApprovalPreviewSnapshotNow,
    resolveShopifyCategoryId,
    shopifyApprovalPreviewSnapshot,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
  };
}