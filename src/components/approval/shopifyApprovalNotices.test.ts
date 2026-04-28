import {
  buildApprovedShopifyListingIdRequiredNotice,
  buildApprovedShopifyListingUpdateFailedNotice,
  buildApprovedShopifyListingUpdatedNotice,
  buildClearedStaleShopifyProductIdNotice,
  buildShopifyDraftAlreadyExistsNotice,
  buildShopifyDraftCreatedNotice,
  buildShopifyDraftCreationFailedNotice,
  buildShopifyDraftIdWritebackFailedNotice,
  buildShopifyDraftUpdateFailedNotice,
  buildShopifyDraftUpdatedNotice,
} from '@/components/approval/shopifyApprovalNotices'

describe('shopifyApprovalNotices', () => {
  it('builds the approved-listing id required notice', () => {
    expect(buildApprovedShopifyListingIdRequiredNotice()).toEqual({
      tone: 'error',
      title: 'Listing update failed',
      message: 'A valid Shopify REST Product ID is required to update an approved listing.',
    })
  })

  it('builds the approved-listing updated notice', () => {
    expect(buildApprovedShopifyListingUpdatedNotice('123')).toEqual({
      tone: 'success',
      title: 'Shopify listing updated',
      message: 'Listing #123 was updated with the latest saved fields.',
    })
  })

  it('builds the approved-listing failure notice', () => {
    expect(buildApprovedShopifyListingUpdateFailedNotice('timeout')).toEqual({
      tone: 'error',
      title: 'Shopify listing update failed',
      message: 'timeout',
    })
  })

  it('builds the draft updated notice', () => {
    expect(buildShopifyDraftUpdatedNotice('456')).toEqual({
      tone: 'success',
      title: 'Shopify draft updated',
      message: 'Draft product #456 was updated with the latest listing fields before approval.',
    })
  })

  it('builds the draft update failure notice', () => {
    expect(buildShopifyDraftUpdateFailedNotice('permission denied')).toEqual({
      tone: 'error',
      title: 'Shopify draft update failed',
      message: 'permission denied',
    })
  })

  it('builds the draft already exists notice', () => {
    expect(buildShopifyDraftAlreadyExistsNotice('789')).toEqual({
      tone: 'info',
      title: 'Shopify draft already exists',
      message: 'Product #789 already existed, so it was updated instead of creating a duplicate draft.',
    })
  })

  it('builds the stale product id cleared notice', () => {
    expect(buildClearedStaleShopifyProductIdNotice('321')).toEqual({
      tone: 'warning',
      title: 'Cleared stale Shopify product ID',
      message: 'Saved product ID #321 was not found in Shopify. Creating a new draft now.',
    })
  })

  it('builds the draft writeback failure notice', () => {
    expect(buildShopifyDraftIdWritebackFailedNotice()).toEqual({
      tone: 'warning',
      title: 'Draft created, ID writeback failed',
      message: 'Shopify draft was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
    })
  })

  it('builds the draft created notice', () => {
    expect(buildShopifyDraftCreatedNotice('654')).toEqual({
      tone: 'success',
      title: 'Shopify draft created',
      message: 'Draft product #654 was created before approval completion.',
    })
  })

  it('builds the draft creation failure notice', () => {
    expect(buildShopifyDraftCreationFailedNotice('invalid category')).toEqual({
      tone: 'error',
      title: 'Shopify draft creation failed',
      message: 'invalid category',
    })
  })
})