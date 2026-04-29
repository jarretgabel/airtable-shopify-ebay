import { getConfiguredRecord, updateConfiguredRecord, type AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import type { ShopifyApprovalPublishResult, ShopifyApprovalPreviewResult as ShopifyApprovalPreview } from '../../shared/contracts/shopifyApproval.js';
import {
  addProductToCollections,
  getProduct,
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
  type ShopifyUnifiedProductResult,
} from './client.js';
import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
  buildShopifyUnifiedProductSetRequest,
} from './approvalDraft.js';

interface PublishApprovalListingParams {
  source: AirtableConfiguredRecordsSource;
  recordId: string;
  productIdFieldName?: string;
  fields?: Record<string, unknown>;
  preview?: ShopifyApprovalPreview;
}

function coerceToString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

async function upsertWithCollectionFallback(params: {
  product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>;
  categoryId?: string;
  collectionIds: string[];
  existingProductId?: number;
}): Promise<{ product: ShopifyUnifiedProductResult; warnings: string[] }> {
  const warnings: string[] = [];
  const normalizedCollectionIds = Array.from(new Set(params.collectionIds.map((value) => value.trim()).filter(Boolean)));
  const ensureCollectionsApplied = async (productId: number) => {
    if (!Number.isFinite(productId) || productId <= 0 || normalizedCollectionIds.length === 0) return;
    await addProductToCollections(productId, normalizedCollectionIds);
  };
  try {
    const request = buildShopifyUnifiedProductSetRequest(params.product, {
      categoryId: params.categoryId,
      collectionIds: normalizedCollectionIds,
      existingProductId: params.existingProductId,
    });
    if (params.existingProductId && normalizedCollectionIds.length > 0) {
      const combinedResult = await upsertExistingProductWithCollectionsInSingleMutation(request, normalizedCollectionIds);
      if (combinedResult.collectionFailures.length > 0) {
        warnings.push(`Collection assignment failed for ${combinedResult.collectionFailures.length} collection(s): ${combinedResult.collectionFailures.join(' | ')}`);
        try {
          await ensureCollectionsApplied(combinedResult.product.id);
        } catch (collectionApplyError) {
          warnings.push(`Fallback collection assignment failed: ${collectionApplyError instanceof Error ? collectionApplyError.message : String(collectionApplyError)}`);
        }
      }
      return { product: combinedResult.product, warnings };
    }
    const upserted = await upsertProductWithUnifiedRequest(request);
    try {
      await ensureCollectionsApplied(upserted.id);
    } catch (collectionApplyError) {
      warnings.push(collectionApplyError instanceof Error ? collectionApplyError.message : String(collectionApplyError));
    }
    return { product: upserted, warnings };
  } catch (error) {
    if (normalizedCollectionIds.length === 0) throw error;
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const isCollectionError = errorMessage.includes('collection')
      || errorMessage.includes('collectionstojoin')
      || errorMessage.includes('collection id');
    if (!isCollectionError) throw error;
    const retried = await upsertProductWithUnifiedRequest(buildShopifyUnifiedProductSetRequest(params.product, {
      categoryId: params.categoryId,
      existingProductId: params.existingProductId,
    }));
    try {
      await ensureCollectionsApplied(retried.id);
    } catch (collectionApplyError) {
      warnings.push(collectionApplyError instanceof Error ? collectionApplyError.message : String(collectionApplyError));
    }
    return { product: retried, warnings };
  }
}

export async function publishApprovalListingToShopify({
  source,
  recordId,
  productIdFieldName = 'Shopify REST Product ID',
  fields: fieldOverrides,
  preview,
}: PublishApprovalListingParams): Promise<ShopifyApprovalPublishResult> {
  const fields = preview && fieldOverrides
    ? fieldOverrides
    : {
      ...((await getConfiguredRecord(source, recordId)).fields ?? {}) as Record<string, unknown>,
      ...(fieldOverrides ?? {}),
    };
  const product = preview?.effectiveProduct ?? buildShopifyDraftProductFromApprovalFields(fields);
  const collectionIds = preview?.collectionIds ?? buildShopifyCollectionIdsFromApprovalFields(fields);
  const warnings = [...(preview?.categoryResolution.status === 'error' && preview.categoryResolution.error
    ? [`${preview.categoryResolution.error} Continuing without category assignment.`]
    : [])];
  const categoryId = preview?.resolvedCategoryId;
  const existingProductIdRaw = coerceToString(fields[productIdFieldName]);
  const parsedExistingProductId = Number(existingProductIdRaw);
  const hasExistingProductId = Number.isFinite(parsedExistingProductId) && parsedExistingProductId > 0;

  if (hasExistingProductId) {
    const existingProduct = await getProduct(parsedExistingProductId);
    if (existingProduct) {
      const updated = await upsertWithCollectionFallback({
        product,
        categoryId,
        collectionIds,
        existingProductId: parsedExistingProductId,
      });
      return {
        productId: String(updated.product.id),
        mode: 'updated',
        warnings: [...warnings, ...updated.warnings],
        wroteProductId: false,
        staleProductIdCleared: false,
      };
    }
  }

  const created = await upsertWithCollectionFallback({
    product,
    categoryId,
    collectionIds,
  });
  let wroteProductId = false;
  try {
    await updateConfiguredRecord(source, recordId, { [productIdFieldName]: String(created.product.id) }, { typecast: true });
    wroteProductId = true;
  } catch (error) {
    warnings.push(error instanceof Error
      ? `Shopify listing was created, but writing ${productIdFieldName} to Airtable failed: ${error.message}`
      : `Shopify listing was created, but writing ${productIdFieldName} to Airtable failed.`);
  }

  return {
    productId: String(created.product.id),
    mode: 'created',
    warnings: [...warnings, ...created.warnings],
    wroteProductId,
    staleProductIdCleared: hasExistingProductId,
  };
}