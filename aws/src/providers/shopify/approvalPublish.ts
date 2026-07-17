import { getConfiguredRecord, updateConfiguredRecord, type AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import type { ShopifyApprovalPublishResult, ShopifyApprovalPreviewResult as ShopifyApprovalPreview } from '../../shared/contracts/shopifyApproval.js';
import { logInfo } from '../../shared/logging.js';
import {
  addProductToCollections,
  findLatestProductByTitleOrHandle,
  getProduct,
  resolveTaxonomyCategory,
  syncProductVariantInventoryLevels,
  uploadImageFile,
  upsertExistingProductWithCollectionsInSingleMutation,
  upsertProductWithUnifiedRequest,
  type ShopifyUnifiedProductResult,
} from './client.js';
import {
  buildShopifyCollectionIdsFromApprovalFields,
  buildShopifyDraftProductFromApprovalFields,
  buildShopifyUnifiedProductSetRequest,
} from './approvalDraft.js';
import { resolveCategoryId, resolveProductCategory } from './approvalPreviewFieldResolvers.js';

interface PublishApprovalListingParams {
  source: AirtableConfiguredRecordsSource;
  recordId: string;
  productIdFieldName?: string;
  fields?: Record<string, unknown>;
  preview?: ShopifyApprovalPreview;
}

interface ResolvedCategoryForPublish {
  categoryId?: string;
  warning?: string;
}

function parseCsvEnv(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isShopifyPublishDebugEnabled(recordId: string): boolean {
  if (isTruthyEnv(process.env.SHOPIFY_APPROVAL_PUBLISH_DEBUG)) {
    return true;
  }

  const allowedRecordIds = parseCsvEnv(process.env.SHOPIFY_APPROVAL_PUBLISH_DEBUG_RECORD_IDS);
  if (allowedRecordIds.length === 0) {
    return false;
  }

  return allowedRecordIds.includes(recordId);
}

function buildPublishDebugFieldSnapshot(fields: Record<string, unknown>): Record<string, unknown> {
  const explicitCandidates = [
    'Shopify REST Product ID',
    'Shopify REST Variant 1 Price',
    'Shopify Variant 1 Price',
    'Shopify Price',
    'Variant Price',
    'Price',
    'Shopify REST Variant 1 Inventory Quantity',
    'Shopify Variant 1 Inventory Quantity',
    'Shopify Inventory Quantity',
    'Shopify Quantity',
    'Available Quantity',
    'Shopify Available Quantity',
    'Available',
    'Quantity',
    'Qty',
    'Shopify GraphQL Category ID',
    'Shopify Extra Category ID',
    'Shopify Category ID',
    'Category ID',
    'Shopify Product Category ID',
    'Shopify Taxonomy Category ID',
    'Shopify Type',
    'Type',
    'Category',
    'Shopify Category',
    'Product Category',
  ];

  const snapshot: Record<string, unknown> = {};
  for (const key of explicitCandidates) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      snapshot[key] = fields[key];
    }
  }

  const dynamicEntries = Object.entries(fields)
    .filter(([key]) => {
      const normalized = key.toLowerCase();
      return normalized.includes('price')
        || normalized.includes('qty')
        || normalized.includes('quantity')
        || normalized.includes('available')
        || normalized.includes('category');
    })
    .slice(0, 40);

  for (const [key, value] of dynamicEntries) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
      snapshot[key] = value;
    }
  }

  return snapshot;
}

function coerceToString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function isShopifyMediaFormatMismatchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes('media upload failed')
    || normalized.includes("file extension doesn't match the format of the file");
}

function getImageExtensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/avif') return 'avif';
  if (normalized === 'image/heic' || normalized === 'image/heif') return 'heic';
  return 'jpg';
}

function getTargetVariantInventoryLevels(product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>): Array<{ sku?: string; position?: number; quantity: number }> {
  const variants = product.variants ?? [];
  const targetLevels: Array<{ sku?: string; position?: number; quantity: number }> = [];

  variants.forEach((variant, index) => {
    const quantity = Number.isFinite(variant.inventory_quantity)
      ? Math.max(0, Math.trunc(Number(variant.inventory_quantity)))
      : undefined;
    if (quantity === undefined) return;

    targetLevels.push({
      sku: variant.sku?.trim() || undefined,
      position: Number.isFinite(variant.position) ? variant.position : index + 1,
      quantity,
    });
  });

  return targetLevels;
}

async function resolveCategoryForPublishWithoutPreview(
  fields: Record<string, unknown>,
  product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>,
): Promise<ResolvedCategoryForPublish> {
  const explicitCategoryId = resolveCategoryId(fields).value.trim();
  if (explicitCategoryId) {
    return { categoryId: explicitCategoryId };
  }

  const categoryFieldResolution = resolveProductCategory(fields, product);
  const lookupValue = categoryFieldResolution.value.trim();
  if (!lookupValue) {
    return {};
  }

  try {
    const match = await resolveTaxonomyCategory(lookupValue);
    if (match?.id) {
      return { categoryId: match.id };
    }

    return {
      warning: `Could not resolve Shopify taxonomy category from "${lookupValue}". Continuing without category assignment.`,
    };
  } catch (error) {
    return {
      warning: `${error instanceof Error ? error.message : String(error)} Continuing without category assignment.`,
    };
  }
}

async function applyInventorySyncWarnings(
  productId: number,
  targetInventoryLevels: Array<{ sku?: string; position?: number; quantity: number }>,
  baseWarnings: string[],
  debugContext?: { enabled: boolean; recordId: string },
): Promise<string[]> {
  if (targetInventoryLevels.length === 0) {
    return baseWarnings;
  }

  if (debugContext?.enabled) {
    logInfo('Shopify approval publish inventory sync starting', {
      recordId: debugContext.recordId,
      productId,
      targetInventoryLevels,
    });
  }

  try {
    await syncProductVariantInventoryLevels(productId, targetInventoryLevels);
    if (debugContext?.enabled) {
      logInfo('Shopify approval publish inventory sync completed', {
        recordId: debugContext.recordId,
        productId,
      });
    }
    return baseWarnings;
  } catch (error) {
    if (debugContext?.enabled) {
      logInfo('Shopify approval publish inventory sync failed', {
        recordId: debugContext.recordId,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [...baseWarnings, error instanceof Error ? error.message : String(error)];
  }
}

async function reuploadProductImagesForShopify(product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>): Promise<ReturnType<typeof buildShopifyDraftProductFromApprovalFields>> {
  if (!product.images || product.images.length === 0) {
    return product;
  }

  const reuploadedImages = await Promise.all(product.images.map(async (image, index) => {
    const sourceUrl = image.src?.trim() ?? '';
    if (!sourceUrl) {
      throw new Error(`Image ${index + 1} is missing a source URL.`);
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Could not download image ${index + 1} (${response.status}).`);
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    const extension = getImageExtensionFromMimeType(mimeType);
    const filename = `listing-image-${index + 1}.${extension}`;
    const buffer = Buffer.from(await response.arrayBuffer());
    const file = buffer.toString('base64');
    const uploaded = await uploadImageFile(filename, mimeType, file, image.alt);

    return {
      ...image,
      src: uploaded.url,
      alt: image.alt,
      position: image.position ?? index + 1,
    };
  }));

  return {
    ...product,
    images: reuploadedImages,
  };
}

async function upsertWithCollectionFallback(params: {
  product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>;
  categoryId?: string;
  collectionIds: string[];
  existingProductId?: number;
}): Promise<{ product: ShopifyUnifiedProductResult; warnings: string[] }> {
  const warnings: string[] = [];
  const normalizedCollectionIds = Array.from(new Set(params.collectionIds.map((value) => value.trim()).filter(Boolean)));
  const runUpsert = async (product: ReturnType<typeof buildShopifyDraftProductFromApprovalFields>) => {
    const request = buildShopifyUnifiedProductSetRequest(product, {
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
      return combinedResult.product;
    }

    const upserted = await upsertProductWithUnifiedRequest(request);
    try {
      await ensureCollectionsApplied(upserted.id);
    } catch (collectionApplyError) {
      warnings.push(collectionApplyError instanceof Error ? collectionApplyError.message : String(collectionApplyError));
    }
    return upserted;
  };

  const ensureCollectionsApplied = async (productId: number) => {
    if (!Number.isFinite(productId) || productId <= 0 || normalizedCollectionIds.length === 0) return;
    await addProductToCollections(productId, normalizedCollectionIds);
  };

  let productForUpsert = params.product;

  try {
    return { product: await runUpsert(productForUpsert), warnings };
  } catch (error) {
    if (isShopifyMediaFormatMismatchError(error) && (productForUpsert.images?.length ?? 0) > 0) {
      productForUpsert = await reuploadProductImagesForShopify(productForUpsert);
      warnings.push('Shopify rejected source image format metadata; retried publish with normalized uploaded media files.');
      return { product: await runUpsert(productForUpsert), warnings };
    }

    if (normalizedCollectionIds.length === 0) throw error;
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const isCollectionError = errorMessage.includes('collection')
      || errorMessage.includes('collectionstojoin')
      || errorMessage.includes('collection id');
    if (!isCollectionError) throw error;
    const retried = await upsertProductWithUnifiedRequest(buildShopifyUnifiedProductSetRequest(productForUpsert, {
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
  const debugEnabled = isShopifyPublishDebugEnabled(recordId);
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
  const fallbackCategory = preview?.resolvedCategoryId
    ? {}
    : await resolveCategoryForPublishWithoutPreview(fields, product);
  if (fallbackCategory.warning) warnings.push(fallbackCategory.warning);
  const categoryId = preview?.resolvedCategoryId || fallbackCategory.categoryId;
  const targetInventoryLevels = getTargetVariantInventoryLevels(product);
  const existingProductIdRaw = coerceToString(fields[productIdFieldName]);
  const parsedExistingProductId = Number(existingProductIdRaw);
  const hasExistingProductId = Number.isFinite(parsedExistingProductId) && parsedExistingProductId > 0;

  if (debugEnabled) {
    logInfo('Shopify approval publish derived payload', {
      recordId,
      source,
      productIdFieldName,
      existingProductIdRaw,
      hasExistingProductId,
      previewProvided: Boolean(preview),
      categoryId,
      categoryWarningCount: warnings.length,
      collectionIds,
      productVariantCount: product.variants?.length ?? 0,
      productVariants: (product.variants ?? []).map((variant, index) => ({
        index: index + 1,
        sku: variant.sku,
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        inventory_quantity: variant.inventory_quantity,
        inventory_management: variant.inventory_management,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
      })),
      targetInventoryLevels,
      debugFieldSnapshot: buildPublishDebugFieldSnapshot(fields),
    });
  }

  if (hasExistingProductId) {
    const existingProduct = await getProduct(parsedExistingProductId);
    if (existingProduct) {
      const updated = await upsertWithCollectionFallback({
        product,
        categoryId,
        collectionIds,
        existingProductId: parsedExistingProductId,
      });
      const resolvedWarnings = await applyInventorySyncWarnings(
        updated.product.id,
        targetInventoryLevels,
        [...warnings, ...updated.warnings],
        { enabled: debugEnabled, recordId },
      );
      return {
        productId: String(updated.product.id),
        mode: 'updated',
        warnings: resolvedWarnings,
        wroteProductId: false,
        staleProductIdCleared: false,
      };
    }
  }

  const duplicateGuardMatch = await findLatestProductByTitleOrHandle({
    title: product.title,
    handle: product.handle,
  });

  if (duplicateGuardMatch && Number.isFinite(duplicateGuardMatch.id) && duplicateGuardMatch.id > 0) {
    const updated = await upsertWithCollectionFallback({
      product,
      categoryId,
      collectionIds,
      existingProductId: duplicateGuardMatch.id,
    });

    let wroteProductId = false;
    if (existingProductIdRaw !== String(duplicateGuardMatch.id)) {
      try {
        await updateConfiguredRecord(source, recordId, { [productIdFieldName]: String(duplicateGuardMatch.id) }, { typecast: true });
        wroteProductId = true;
      } catch (error) {
        warnings.push(error instanceof Error
          ? `Found existing Shopify draft #${duplicateGuardMatch.id}, but writing ${productIdFieldName} to Airtable failed: ${error.message}`
          : `Found existing Shopify draft #${duplicateGuardMatch.id}, but writing ${productIdFieldName} to Airtable failed.`);
      }
    }

    warnings.push(`Found existing Shopify draft #${duplicateGuardMatch.id} by title/handle and updated it instead of creating a duplicate draft.`);

    const resolvedWarnings = await applyInventorySyncWarnings(
      updated.product.id,
      targetInventoryLevels,
      [...warnings, ...updated.warnings],
      { enabled: debugEnabled, recordId },
    );

    return {
      productId: String(updated.product.id),
      mode: 'updated',
      warnings: resolvedWarnings,
      wroteProductId,
      staleProductIdCleared: hasExistingProductId,
    };
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

  const resolvedWarnings = await applyInventorySyncWarnings(
    created.product.id,
    targetInventoryLevels,
    [...warnings, ...created.warnings],
    { enabled: debugEnabled, recordId },
  );

  return {
    productId: String(created.product.id),
    mode: 'created',
    warnings: resolvedWarnings,
    wroteProductId,
    staleProductIdCleared: hasExistingProductId,
  };
}