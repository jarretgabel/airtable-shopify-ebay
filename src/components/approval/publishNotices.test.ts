import {
  buildEbayPublishSuccessNotice,
  buildPublishFailureNotice,
  buildShopifyPublishSuccessNotice,
} from '@/components/approval/publishNotices'

describe('publishNotices', () => {
  it('builds a Shopify created notice', () => {
    expect(buildShopifyPublishSuccessNotice({
      productId: '101',
      mode: 'created',
    })).toEqual({
      tone: 'success',
      title: 'Shopify listing created',
      message: 'Shopify product #101 was created.',
    })
  })

  it('builds a Shopify updated notice', () => {
    expect(buildShopifyPublishSuccessNotice({
      productId: '202',
      mode: 'updated',
    })).toEqual({
      tone: 'success',
      title: 'Shopify listing updated',
      message: 'Shopify product #202 was updated.',
    })
  })

  it('builds an eBay published notice', () => {
    expect(buildEbayPublishSuccessNotice({
      sku: 'ABC-123',
      offerId: 'offer-1',
      listingId: 'listing-1',
      mode: 'created',
    })).toEqual({
      tone: 'success',
      title: 'eBay listing published',
      message: 'SKU ABC-123 is live as listing listing-1 via offer offer-1.',
    })
  })

  it('builds an eBay updated notice', () => {
    expect(buildEbayPublishSuccessNotice({
      sku: 'XYZ-999',
      offerId: 'offer-2',
      listingId: 'listing-2',
      mode: 'updated',
    })).toEqual({
      tone: 'success',
      title: 'eBay listing updated',
      message: 'SKU XYZ-999 is live as listing listing-2 via offer offer-2.',
    })
  })

  it('builds a failure notice from an Error', () => {
    expect(buildPublishFailureNotice(new Error('timeout'))).toEqual({
      tone: 'error',
      title: 'Publish failed',
      message: 'timeout',
    })
  })

  it('falls back to the default failure message for unknown errors', () => {
    expect(buildPublishFailureNotice({ code: 'E_UNKNOWN' })).toEqual({
      tone: 'error',
      title: 'Publish failed',
      message: 'Unable to push this listing.',
    })
  })
})