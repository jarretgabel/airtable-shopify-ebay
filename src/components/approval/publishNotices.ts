export type PublishNoticeTone = 'success' | 'error'

export interface PublishNotice {
  tone: PublishNoticeTone
  title: string
  message: string
}

export interface ShopifyPublishResult {
  productId: string
  mode: 'created' | 'updated'
}

export interface EbayPublishResult {
  sku: string
  offerId: string
  listingId: string
  mode: 'created' | 'updated'
}

export function buildShopifyPublishSuccessNotice(result: ShopifyPublishResult): PublishNotice {
  return {
    tone: 'success',
    title: result.mode === 'updated' ? 'Shopify listing updated' : 'Shopify listing created',
    message: `Shopify product #${result.productId} was ${result.mode}.`,
  }
}

export function buildEbayPublishSuccessNotice(result: EbayPublishResult): PublishNotice {
  return {
    tone: 'success',
    title: result.mode === 'updated' ? 'eBay listing updated' : 'eBay listing published',
    message: `SKU ${result.sku} is live as listing ${result.listingId} via offer ${result.offerId}.`,
  }
}

export function buildPublishFailureNotice(error: unknown): PublishNotice {
  return {
    tone: 'error',
    title: 'Publish failed',
    message: error instanceof Error ? error.message : 'Unable to push this listing.',
  }
}