import type {
  ShopifyCollectionMatch,
  ShopifyTaxonomyCategoryMatch,
  ShopifyUploadedImageResult,
  ShopifyUnifiedProductSetRequest,
  ShopifyUnifiedProductResult,
  ShopifyUnifiedUpsertWithCollectionsResult,
} from '@/services/shopify';
import type { ShopifyProductsResponse } from '@/types/shopify';
import { isAppApiHttpError } from './errors';
import { isLambdaShopifyEnabled } from './flags';
import { getJson, postJson } from './http';

function toShopifyError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
}

async function getDirectProducts(limit: number): Promise<ShopifyProductsResponse['products']> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.getProducts(limit);
}

async function getDirectProduct(id: number): Promise<ShopifyUnifiedProductResult | null> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.getProduct(id);
}

async function getDirectCollections(first: number): Promise<ShopifyCollectionMatch[]> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.getCollections(first);
}

async function searchDirectCollections(search: string, first: number): Promise<ShopifyCollectionMatch[]> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.searchCollections(search, first);
}

async function searchDirectTaxonomyCategories(search: string, first: number): Promise<ShopifyTaxonomyCategoryMatch[]> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.searchTaxonomyCategories(search, first);
}

async function resolveDirectTaxonomyCategory(searchOrId: string): Promise<ShopifyTaxonomyCategoryMatch | null> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.resolveTaxonomyCategory(searchOrId);
}

async function upsertDirectProductWithUnifiedRequest(
  request: ShopifyUnifiedProductSetRequest,
): Promise<ShopifyUnifiedProductResult> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.upsertProductWithUnifiedRequest(request);
}

async function upsertDirectExistingProductWithCollectionsInSingleMutation(
  request: ShopifyUnifiedProductSetRequest,
  collectionIds: string[],
): Promise<ShopifyUnifiedUpsertWithCollectionsResult> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.upsertExistingProductWithCollectionsInSingleMutation(request, collectionIds);
}

async function addDirectProductToCollections(productId: number, collectionIds: string[]): Promise<void> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.addProductToCollections(productId, collectionIds);
}

async function updateDirectProductCategory(productId: number, categoryId: string): Promise<void> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.updateProductCategory(productId, categoryId);
}

async function uploadDirectImageFile(file: File, alt?: string): Promise<ShopifyUploadedImageResult> {
  const { shopifyService } = await import('@/services/shopify');
  return shopifyService.uploadImageFile(file, alt);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Unable to read ${file.name}.`));
        return;
      }

      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export async function getProducts(limit = 50): Promise<ShopifyProductsResponse['products']> {
  if (!isLambdaShopifyEnabled()) {
    return getDirectProducts(limit);
  }

  try {
    return await getJson<ShopifyProductsResponse['products']>('/api/shopify/products', { limit });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function getProduct(id: number): Promise<ShopifyUnifiedProductResult | null> {
  if (!isLambdaShopifyEnabled()) {
    return getDirectProduct(id);
  }

  try {
    return await getJson<ShopifyUnifiedProductResult | null>(`/api/shopify/products/${id}`);
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function getCollections(first = 250): Promise<ShopifyCollectionMatch[]> {
  if (!isLambdaShopifyEnabled()) {
    return getDirectCollections(first);
  }

  try {
    return await getJson<ShopifyCollectionMatch[]>('/api/shopify/collections', { first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function searchCollections(search: string, first = 250): Promise<ShopifyCollectionMatch[]> {
  if (!isLambdaShopifyEnabled()) {
    return searchDirectCollections(search, first);
  }

  try {
    return await getJson<ShopifyCollectionMatch[]>('/api/shopify/collections/search', { search, first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function searchTaxonomyCategories(search: string, first = 10): Promise<ShopifyTaxonomyCategoryMatch[]> {
  if (!isLambdaShopifyEnabled()) {
    return searchDirectTaxonomyCategories(search, first);
  }

  try {
    return await getJson<ShopifyTaxonomyCategoryMatch[]>('/api/shopify/taxonomy-categories/search', { search, first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function resolveTaxonomyCategory(searchOrId: string): Promise<ShopifyTaxonomyCategoryMatch | null> {
  if (!isLambdaShopifyEnabled()) {
    return resolveDirectTaxonomyCategory(searchOrId);
  }

  try {
    return await getJson<ShopifyTaxonomyCategoryMatch | null>('/api/shopify/taxonomy-categories/resolve', { searchOrId });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function upsertProductWithUnifiedRequest(
  request: ShopifyUnifiedProductSetRequest,
): Promise<ShopifyUnifiedProductResult> {
  if (!isLambdaShopifyEnabled()) {
    return upsertDirectProductWithUnifiedRequest(request);
  }

  try {
    return await postJson<ShopifyUnifiedProductResult>('/api/shopify/product-set', { request });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function upsertExistingProductWithCollectionsInSingleMutation(
  request: ShopifyUnifiedProductSetRequest,
  collectionIds: string[],
): Promise<ShopifyUnifiedUpsertWithCollectionsResult> {
  if (!isLambdaShopifyEnabled()) {
    return upsertDirectExistingProductWithCollectionsInSingleMutation(request, collectionIds);
  }

  try {
    return await postJson<ShopifyUnifiedUpsertWithCollectionsResult>('/api/shopify/product-set-with-collections', {
      request,
      collectionIds,
    });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function addProductToCollections(productId: number, collectionIds: string[]): Promise<void> {
  if (!isLambdaShopifyEnabled()) {
    return addDirectProductToCollections(productId, collectionIds);
  }

  try {
    await postJson<{ assigned: true }>(`/api/shopify/products/${productId}/collections`, { collectionIds });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function updateProductCategory(productId: number, categoryId: string): Promise<void> {
  if (!isLambdaShopifyEnabled()) {
    return updateDirectProductCategory(productId, categoryId);
  }

  try {
    await postJson<{ updated: true }>(`/api/shopify/products/${productId}/category`, { categoryId });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function uploadImageFile(file: File, alt?: string): Promise<ShopifyUploadedImageResult> {
  if (!isLambdaShopifyEnabled()) {
    return uploadDirectImageFile(file, alt);
  }

  try {
    const base64 = await fileToBase64(file);
    return await postJson<ShopifyUploadedImageResult>('/api/shopify/images', {
      filename: file.name,
      mimeType: file.type || 'image/jpeg',
      file: base64,
      alt,
    });
  } catch (error) {
    throw toShopifyError(error);
  }
}