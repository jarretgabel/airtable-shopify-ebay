import {
  buildApprovedShopifyListingIdRequiredNotice,
  buildApprovedShopifyListingUpdateFailedNotice,
  buildApprovedShopifyListingUpdatedNotice,
  type ShopifyApprovalNotice,
} from '@/components/approval/shopifyApprovalNotices'
import type { AirtableRecord } from '@/types/airtable'

export interface UpdateApprovedShopifyListingParams {
  existingProductId: string
  record: AirtableRecord
}

export interface UpdateApprovedShopifyListingDependencies {
  syncExistingShopifyListing: (record: AirtableRecord, productId: number) => Promise<void>
  describeError: (error: unknown) => string
}

export async function updateApprovedShopifyListing(
  params: UpdateApprovedShopifyListingParams,
  dependencies: UpdateApprovedShopifyListingDependencies,
): Promise<ShopifyApprovalNotice> {
  const { existingProductId, record } = params
  const { describeError, syncExistingShopifyListing } = dependencies

  const normalizedProductId = existingProductId.trim()
  const parsedExistingId = Number(normalizedProductId)

  if (!Number.isFinite(parsedExistingId) || parsedExistingId <= 0) {
    return buildApprovedShopifyListingIdRequiredNotice()
  }

  try {
    await syncExistingShopifyListing(record, parsedExistingId)
    return buildApprovedShopifyListingUpdatedNotice(normalizedProductId)
  } catch (error) {
    return buildApprovedShopifyListingUpdateFailedNotice(describeError(error))
  }
}