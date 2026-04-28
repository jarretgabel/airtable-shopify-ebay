import {
  buildClearedStaleShopifyProductIdNotice,
  buildShopifyDraftAlreadyExistsNotice,
  buildShopifyDraftCreatedNotice,
  buildShopifyDraftCreationFailedNotice,
  buildShopifyDraftIdWritebackFailedNotice,
  buildShopifyDraftUpdateFailedNotice,
  buildShopifyDraftUpdatedNotice,
  type ShopifyApprovalNotice,
} from '@/components/approval/shopifyApprovalNotices'
import type { ShopifyCollectionFallbackParams } from '@/components/approval/shopifyPublish'
import type { ShopifyProductIdWritebackParams } from '@/components/approval/shopifyWriteback'
import type { AirtableRecord } from '@/types/airtable'
import type { ShopifyProduct } from '@/types/shopify'

export interface EnsureShopifyDraftBeforeApprovalParams {
  existingProductId: string
  productIdFieldName: string
  createPayload: ShopifyProduct
  record: AirtableRecord
  collectionIds: string[]
  tableReference?: string
  tableName?: string
}

export interface EnsureShopifyDraftBeforeApprovalDependencies {
  getShopifyProduct: (productId: number) => Promise<unknown>
  syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>
  describeError: (error: unknown) => string
  resolveShopifyCategoryId: () => Promise<string | undefined>
  upsertShopifyProductWithCollectionFallback: (
    params: ShopifyCollectionFallbackParams,
  ) => Promise<{ id: number }>
  writeShopifyProductIdToAirtable: (
    params: ShopifyProductIdWritebackParams,
  ) => Promise<{ productId: string; wrote: boolean; lastError: unknown | null }>
}

export interface EnsureShopifyDraftBeforeApprovalResult {
  notices: ShopifyApprovalNotice[]
  nextProductIdFieldValue?: string
  createdProductId?: number
  status: 'existing-updated' | 'created' | 'update-failed' | 'creation-failed'
}

export async function ensureShopifyDraftBeforeApproval(
  params: EnsureShopifyDraftBeforeApprovalParams,
  dependencies: EnsureShopifyDraftBeforeApprovalDependencies,
): Promise<EnsureShopifyDraftBeforeApprovalResult> {
  const {
    collectionIds,
    createPayload,
    existingProductId,
    productIdFieldName,
    record,
    tableName,
    tableReference,
  } = params
  const {
    describeError,
    getShopifyProduct,
    resolveShopifyCategoryId,
    syncExistingShopifyListing,
    upsertShopifyProductWithCollectionFallback,
    writeShopifyProductIdToAirtable,
  } = dependencies

  const normalizedExistingProductId = existingProductId.trim()
  let nextProductIdFieldValue: string | undefined

  if (normalizedExistingProductId) {
    const parsedExistingId = Number(normalizedExistingProductId)

    if (Number.isFinite(parsedExistingId) && parsedExistingId > 0) {
      const existingProduct = await getShopifyProduct(parsedExistingId)

      if (existingProduct) {
        try {
          await syncExistingShopifyListing(record, parsedExistingId)
          return {
            status: 'existing-updated',
            notices: [
              buildShopifyDraftUpdatedNotice(normalizedExistingProductId),
              buildShopifyDraftAlreadyExistsNotice(normalizedExistingProductId),
            ],
          }
        } catch (error) {
          return {
            status: 'update-failed',
            notices: [buildShopifyDraftUpdateFailedNotice(describeError(error))],
          }
        }
      }

      nextProductIdFieldValue = ''
      const categoryId = await resolveShopifyCategoryId()
      try {
        const createdProduct = await upsertShopifyProductWithCollectionFallback({
          product: createPayload,
          categoryId,
          collectionIds,
        })
        const writebackResult = await writeShopifyProductIdToAirtable({
          fieldName: productIdFieldName,
          productId: createdProduct.id,
          recordId: record.id,
          tableReference,
          tableName,
        })

        return {
          status: 'created',
          createdProductId: createdProduct.id,
          nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : '',
          notices: [
            buildClearedStaleShopifyProductIdNotice(normalizedExistingProductId),
            ...(writebackResult.wrote ? [] : [buildShopifyDraftIdWritebackFailedNotice()]),
            buildShopifyDraftCreatedNotice(writebackResult.productId),
          ],
        }
      } catch (error) {
        return {
          status: 'creation-failed',
          nextProductIdFieldValue,
          notices: [
            buildClearedStaleShopifyProductIdNotice(normalizedExistingProductId),
            buildShopifyDraftCreationFailedNotice(describeError(error)),
          ],
        }
      }
    }

    nextProductIdFieldValue = ''
  }

  const categoryId = await resolveShopifyCategoryId()

  try {
    const createdProduct = await upsertShopifyProductWithCollectionFallback({
      product: createPayload,
      categoryId,
      collectionIds,
    })
    const writebackResult = await writeShopifyProductIdToAirtable({
      fieldName: productIdFieldName,
      productId: createdProduct.id,
      recordId: record.id,
      tableReference,
      tableName,
    })

    return {
      status: 'created',
      createdProductId: createdProduct.id,
      nextProductIdFieldValue: writebackResult.wrote ? writebackResult.productId : nextProductIdFieldValue ?? '',
      notices: [
        ...(writebackResult.wrote ? [] : [buildShopifyDraftIdWritebackFailedNotice()]),
        buildShopifyDraftCreatedNotice(writebackResult.productId),
      ],
    }
  } catch (error) {
    return {
      status: 'creation-failed',
      nextProductIdFieldValue,
      notices: [buildShopifyDraftCreationFailedNotice(describeError(error))],
    }
  }
}