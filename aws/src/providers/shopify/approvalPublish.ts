import { getConfiguredRecord, updateConfiguredRecord, type AirtableConfiguredRecordsSource } from '../airtable/sources.js';
import type { ShopifyApprovalPublishResult, ShopifyApprovalPreviewResult as ShopifyApprovalPreview } from '../../shared/contracts/shopifyApproval.js';
import {
  addProductToCollections,
  findLatestProductByTitleOrHandle,
  getProduct,
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

    return {
      productId: String(updated.product.id),
      mode: 'updated',
      warnings: [...warnings, ...updated.warnings],
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

  return {
    productId: String(created.product.id),
    mode: 'created',
    warnings: [...warnings, ...created.warnings],
    wroteProductId,
    staleProductIdCleared: hasExistingProductId,
  };
}