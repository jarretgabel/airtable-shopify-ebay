import type {
  ShopifyUnifiedProductResult,
  ShopifyUnifiedProductSetRequest,
  ShopifyUnifiedUpsertWithCollectionsResult,
} from '@/services/shopify'
import type { ShopifyProduct } from '@/types/shopify'

export interface ShopifyCollectionFallbackParams {
  product: ShopifyProduct
  categoryId?: string
  collectionIds?: string[]
  existingProductId?: number
}

export interface ShopifyCollectionFallbackDependencies {
  buildRequest: (
    product: ShopifyProduct,
    options?: {
      categoryId?: string
      collectionIds?: string[]
      existingProductId?: number
    },
  ) => ShopifyUnifiedProductSetRequest
  upsertProduct: (request: ShopifyUnifiedProductSetRequest) => Promise<ShopifyUnifiedProductResult>
  upsertExistingProductWithCollections: (
    request: ShopifyUnifiedProductSetRequest,
    collectionIds: string[],
  ) => Promise<ShopifyUnifiedUpsertWithCollectionsResult>
  addProductToCollections: (productId: number, collectionIds: string[]) => Promise<void>
  describeError: (error: unknown) => string
  describeCollectionJoinFailure: (detail: string) => string
  pushNotice?: (tone: 'info' | 'warning', title: string, message: string) => void
}

export async function upsertShopifyProductWithCollectionFallback(
  params: ShopifyCollectionFallbackParams,
  dependencies: ShopifyCollectionFallbackDependencies,
): Promise<ShopifyUnifiedProductResult> {
  const { product, categoryId, collectionIds = [], existingProductId } = params
  const {
    addProductToCollections,
    buildRequest,
    describeCollectionJoinFailure,
    describeError,
    pushNotice,
    upsertExistingProductWithCollections,
    upsertProduct,
  } = dependencies

  const normalizedCollectionIds = Array.from(new Set(
    collectionIds
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  ))

  pushNotice?.(
    'info',
    'Collections payload debug',
    normalizedCollectionIds.length > 0 ? normalizedCollectionIds.join(', ') : '(none)',
  )

  const unifiedRequest = buildRequest(product, {
    categoryId: categoryId ?? undefined,
    collectionIds: normalizedCollectionIds,
    existingProductId,
  })

  const ensureCollectionsApplied = async (productId: number) => {
    if (!Number.isFinite(productId) || productId <= 0 || normalizedCollectionIds.length === 0) return
    await addProductToCollections(productId, normalizedCollectionIds)
  }

  try {
    if (existingProductId && normalizedCollectionIds.length > 0) {
      const combinedResult = await upsertExistingProductWithCollections(
        unifiedRequest,
        normalizedCollectionIds,
      )

      if (combinedResult.collectionFailures.length > 0) {
        const combinedFailureDetail = `Collection assignment failed for ${combinedResult.collectionFailures.length} collection(s): ${combinedResult.collectionFailures.join(' | ')}`

        try {
          await ensureCollectionsApplied(combinedResult.product.id)
        } catch (collectionApplyError) {
          const fallbackFailureDetail = describeError(collectionApplyError)
          const detail = `${combinedFailureDetail} | Fallback collection assignment failed: ${fallbackFailureDetail}`
          const explanation = describeCollectionJoinFailure(detail)
          pushNotice?.('warning', 'Some collections were not applied', explanation)
        }
      }

      return combinedResult.product
    }

    const upserted = await upsertProduct(unifiedRequest)
    try {
      await ensureCollectionsApplied(upserted.id)
    } catch (collectionApplyError) {
      const detail = describeError(collectionApplyError)
      const explanation = describeCollectionJoinFailure(detail)
      pushNotice?.('warning', 'Some collections were not applied', explanation)
    }
    return upserted
  } catch (error) {
    if (normalizedCollectionIds.length === 0) {
      throw error
    }

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : ''
    const isCollectionError = errorMessage.includes('collection')
      || errorMessage.includes('collectionstojoin')
      || errorMessage.includes('collection id')

    if (!isCollectionError) {
      throw error
    }

    const retryWithoutCollections = buildRequest(product, {
      categoryId: categoryId ?? undefined,
      existingProductId,
    })

    const retried = await upsertProduct(retryWithoutCollections)
    try {
      await ensureCollectionsApplied(retried.id)
    } catch (collectionApplyError) {
      const detail = describeError(collectionApplyError)
      const explanation = describeCollectionJoinFailure(detail)
      pushNotice?.('warning', 'Collections were partially skipped', explanation)
    }
    return retried
  }
}