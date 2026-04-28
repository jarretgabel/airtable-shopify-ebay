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
import { getJson, postJson } from './http';

function toShopifyError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return new Error(error.message);
  }

  return error instanceof Error ? error : new Error(String(error));
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
  try {
    return await getJson<ShopifyProductsResponse['products']>('/api/shopify/products', { limit });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function getProduct(id: number): Promise<ShopifyUnifiedProductResult | null> {
  try {
    return await getJson<ShopifyUnifiedProductResult | null>(`/api/shopify/products/${id}`);
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function getCollections(first = 250): Promise<ShopifyCollectionMatch[]> {
  try {
    return await getJson<ShopifyCollectionMatch[]>('/api/shopify/collections', { first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function searchCollections(search: string, first = 250): Promise<ShopifyCollectionMatch[]> {
  try {
    return await getJson<ShopifyCollectionMatch[]>('/api/shopify/collections/search', { search, first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function searchTaxonomyCategories(search: string, first = 10): Promise<ShopifyTaxonomyCategoryMatch[]> {
  try {
    return await getJson<ShopifyTaxonomyCategoryMatch[]>('/api/shopify/taxonomy-categories/search', { search, first });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function resolveTaxonomyCategory(searchOrId: string): Promise<ShopifyTaxonomyCategoryMatch | null> {
  try {
    return await getJson<ShopifyTaxonomyCategoryMatch | null>('/api/shopify/taxonomy-categories/resolve', { searchOrId });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function upsertProductWithUnifiedRequest(
  request: ShopifyUnifiedProductSetRequest,
): Promise<ShopifyUnifiedProductResult> {
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
  try {
    await postJson<{ assigned: true }>(`/api/shopify/products/${productId}/collections`, { collectionIds });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function updateProductCategory(productId: number, categoryId: string): Promise<void> {
  try {
    await postJson<{ updated: true }>(`/api/shopify/products/${productId}/category`, { categoryId });
  } catch (error) {
    throw toShopifyError(error);
  }
}

export async function uploadImageFile(file: File, alt?: string): Promise<ShopifyUploadedImageResult> {
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