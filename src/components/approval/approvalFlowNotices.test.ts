import {
  buildApprovalFailedNotice,
  buildCreateShopifyListingFailedNotice,
  buildListingSaveFailedNotice,
  buildListingUpdatedNotice,
  buildMissingFieldsBeforeApproveNotice,
  buildMissingFieldsBeforePublishNotice,
  buildNewShopifyListingCreatedNotice,
  buildPageDataResetNotice,
  buildSaveUpdatesFirstNotice,
  buildShopifyPublishIdWritebackFailedNotice,
} from '@/components/approval/approvalFlowNotices'

describe('approvalFlowNotices', () => {
  it('builds the new Shopify listing created notice', () => {
    expect(buildNewShopifyListingCreatedNotice()).toEqual({
      tone: 'success',
      title: 'New Shopify listing created',
      message: 'A new Airtable row is ready. Fill the required Shopify fields, save, then approve.',
    })
  })

  it('builds the Shopify listing creation failure notice', () => {
    expect(buildCreateShopifyListingFailedNotice('timeout')).toEqual({
      tone: 'error',
      title: 'Unable to create Shopify listing',
      message: 'timeout',
    })
  })

  it('builds the publish writeback failure notice', () => {
    expect(buildShopifyPublishIdWritebackFailedNotice()).toEqual({
      tone: 'warning',
      title: 'Shopify publish succeeded, ID writeback failed',
      message: 'The Shopify listing was created, but writing Shopify REST Product ID to Airtable failed. You may need to save the ID manually.',
    })
  })

  it('builds the save-updates-first notice', () => {
    expect(buildSaveUpdatesFirstNotice()).toEqual({
      tone: 'warning',
      title: 'Save updates first',
      message: 'Save page data before publishing to Shopify or eBay.',
    })
  })

  it('builds the Shopify missing-fields-before-publish notice', () => {
    expect(buildMissingFieldsBeforePublishNotice('shopify', ['Title', 'Vendor'])).toEqual({
      tone: 'warning',
      title: 'Required Shopify fields missing',
      message: 'Complete required Shopify fields before publishing: Title, Vendor',
    })
  })

  it('builds the eBay missing-fields-before-publish notice', () => {
    expect(buildMissingFieldsBeforePublishNotice('ebay', ['SKU'])).toEqual({
      tone: 'warning',
      title: 'Required eBay fields missing',
      message: 'Complete required eBay fields before publishing: SKU',
    })
  })

  it('builds the Shopify missing-fields-before-approve notice', () => {
    expect(buildMissingFieldsBeforeApproveNotice('shopify', ['Title'])).toEqual({
      tone: 'warning',
      title: 'Required Shopify fields missing',
      message: 'Complete required fields before approving: Title',
    })
  })

  it('builds the page reset notice', () => {
    expect(buildPageDataResetNotice()).toEqual({
      tone: 'info',
      title: 'Page data reset',
      message: 'Form values were restored to current Airtable values.',
    })
  })

  it('builds the listing updated notice', () => {
    expect(buildListingUpdatedNotice()).toEqual({
      tone: 'success',
      title: 'Listing updated',
      message: 'Listing changes were saved to Airtable.',
    })
  })

  it('builds the listing save failure notice', () => {
    expect(buildListingSaveFailedNotice()).toEqual({
      tone: 'error',
      title: 'Save failed',
      message: 'Could not save listing changes to Airtable. Review the error section and try again.',
    })
  })

  it('builds the approval failure notice', () => {
    expect(buildApprovalFailedNotice()).toEqual({
      tone: 'error',
      title: 'Approval failed',
      message: 'Could not mark this listing as approved in Airtable.',
    })
  })
})