import axios from 'axios';
import { upsertShopifyProductWithCollectionFallback as runShopifyCollectionFallbackUpsert } from '@/components/approval/shopifyPublish';
import type { InlineNoticeTone } from '@/components/approval/listingApprovalRecordActionTypes';
import {
  addProductToCollections as addShopifyProductToCollections,
  upsertExistingProductWithCollectionsInSingleMutation as upsertShopifyExistingProductWithCollections,
  upsertProductWithUnifiedRequest as upsertShopifyProduct,
} from '@/services/app-api/shopify';
import { buildShopifyUnifiedProductSetRequest } from '@/services/shopify';
import type { ShopifyProduct } from '@/types/shopify';

interface ShopifyApprovalPreviewSummary {
  collectionIds: string[];
  effectiveProduct: ShopifyProduct;
  resolvedCategoryId?: string;
}

interface UseListingApprovalShopifySupportParams {
  currentPageCategoryIdValue: string;
  loadShopifyApprovalPreviewNow: (fields: Record<string, unknown>) => Promise<ShopifyApprovalPreviewSummary>;
  pushInlineActionNotice: (tone: InlineNoticeTone, title: string, message: string) => void;
  shopifyApprovalPreview: ShopifyApprovalPreviewSummary | null;
  shopifyResolvedCategoryId?: string;
}

export function useListingApprovalShopifySupport({
  currentPageCategoryIdValue,
  loadShopifyApprovalPreviewNow,
  pushInlineActionNotice,
  shopifyApprovalPreview,
  shopifyResolvedCategoryId,
}: UseListingApprovalShopifySupportParams) {
  const describeShopifyCreateError = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { errors?: unknown; error?: unknown; message?: unknown } | undefined;
      if (typeof data?.errors === 'string') return data.errors;
      if (data?.errors && typeof data.errors === 'object') return JSON.stringify(data.errors);
      if (typeof data?.error === 'string') return data.error;
      if (typeof data?.message === 'string') return data.message;
      if (typeof error.message === 'string' && error.message.length > 0) return error.message;
    }
    return error instanceof Error ? error.message : 'Unable to create Shopify draft product or save its ID back to Airtable.';
  };

  const describeCollectionJoinFailure = (detail: string): string => {
    const smartCollectionMatchIterator = detail.matchAll(/(gid:\/\/shopify\/Collection\/\d+):\s*Can't manually add products to a smart collection/gi);
    const smartCollectionIds = Array.from(smartCollectionMatchIterator)
      .map((match) => match[1])
      .filter((value): value is string => typeof value === 'string' && value.length > 0);

    if (smartCollectionIds.length > 0) {
      return [
        'Some selected collections are smart collections, and Shopify does not allow manual product assignment to smart collections.',
        `Remove or replace these IDs in Airtable Collections: ${smartCollectionIds.join(', ')}.`,
        'The listing was saved, but those collection joins were skipped.',
      ].join(' ');
    }

    return [
      'Shopify rejected one or more collection joins after the listing save/update succeeded.',
      'This usually means invalid, stale, or non-manually-assignable collection IDs.',
      `Details: ${detail}`,
    ].join(' ');
  };

  const resolveShopifyCategoryId = async (): Promise<string | undefined> => {
    return currentPageCategoryIdValue.trim() || shopifyResolvedCategoryId;
  };

  const upsertShopifyProductWithCollectionFallback = async (params: {
    product: ShopifyProduct;
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  }) => runShopifyCollectionFallbackUpsert(params, {
    addProductToCollections: addShopifyProductToCollections,
    buildRequest: buildShopifyUnifiedProductSetRequest,
    describeCollectionJoinFailure,
    describeError: describeShopifyCreateError,
    pushNotice: pushInlineActionNotice,
    upsertExistingProductWithCollections: upsertShopifyExistingProductWithCollections,
    upsertProduct: upsertShopifyProduct,
  });

  const syncExistingShopifyListing = async (record: { fields: Record<string, unknown> }, productId: number) => {
    const preview = shopifyApprovalPreview ?? await loadShopifyApprovalPreviewNow(record.fields);
    const categoryId = preview.resolvedCategoryId || await resolveShopifyCategoryId();
    await upsertShopifyProductWithCollectionFallback({
      product: preview.effectiveProduct,
      categoryId,
      collectionIds: preview.collectionIds,
      existingProductId: productId,
    });
  };

  return {
    describeShopifyCreateError,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
  };
}