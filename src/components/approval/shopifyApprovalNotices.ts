export type ShopifyApprovalNoticeTone = 'info' | 'success' | 'warning' | 'error'

export interface ShopifyApprovalNotice {
  tone: ShopifyApprovalNoticeTone
  title: string
  message: string
}

export function buildApprovedShopifyListingIdRequiredNotice(): ShopifyApprovalNotice {
  return {
    tone: 'error',
    title: 'Listing update failed',
    message: 'A valid Shopify REST Product ID is required to update an approved listing.',
  }
}

export function buildApprovedShopifyListingUpdatedNotice(productId: string): ShopifyApprovalNotice {
  return {
    tone: 'success',
    title: 'Shopify listing updated',
    message: `Listing #${productId} was updated with the latest saved fields.`,
  }
}

export function buildApprovedShopifyListingUpdateFailedNotice(message: string): ShopifyApprovalNotice {
  return {
    tone: 'error',
    title: 'Shopify listing update failed',
    message,
  }
}

export function buildShopifyDraftUpdatedNotice(productId: string): ShopifyApprovalNotice {
  return {
    tone: 'success',
    title: 'Shopify draft updated',
    message: `Draft product #${productId} was updated with the latest listing fields before approval.`,
  }
}

export function buildShopifyDraftUpdateFailedNotice(message: string): ShopifyApprovalNotice {
  return {
    tone: 'error',
    title: 'Shopify draft update failed',
    message,
  }
}

export function buildShopifyDraftAlreadyExistsNotice(productId: string): ShopifyApprovalNotice {
  return {
    tone: 'info',
    title: 'Shopify draft already exists',
    message: `Product #${productId} already existed, so it was updated instead of creating a duplicate draft.`,
  }
}

export function buildClearedStaleShopifyProductIdNotice(productId: string): ShopifyApprovalNotice {
  return {
    tone: 'warning',
    title: 'Cleared stale Shopify product ID',
    message: `Saved product ID #${productId} was not found in Shopify. Creating a new draft now.`,
  }
}

export function buildShopifyDraftIdWritebackFailedNotice(): ShopifyApprovalNotice {
  return {
    tone: 'warning',
    title: 'Draft created, ID writeback failed',
    message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
  }
}

export function buildShopifyDraftCreatedNotice(productId: string): ShopifyApprovalNotice {
  return {
    tone: 'success',
    title: 'Shopify draft created',
    message: `Draft product #${productId} was created before approval completion.`,
  }
}

export function buildShopifyDraftCreationFailedNotice(message: string): ShopifyApprovalNotice {
  return {
    tone: 'error',
    title: 'Shopify draft creation failed',
    message,
  }
}