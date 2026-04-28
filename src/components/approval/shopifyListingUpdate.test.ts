import { updateApprovedShopifyListing } from '@/components/approval/shopifyListingUpdate'
import type { AirtableRecord } from '@/types/airtable'

function createRecord(): AirtableRecord {
  return {
    id: 'rec_1',
    fields: {},
    createdTime: '2026-04-27T00:00:00.000Z',
  }
}

describe('shopifyListingUpdate', () => {
  it('returns the invalid-id notice when the product id is unusable', async () => {
    const result = await updateApprovedShopifyListing({
      existingProductId: 'abc',
      record: createRecord(),
    }, {
      syncExistingShopifyListing: vi.fn(),
      describeError: (error) => String(error),
    })

    expect(result).toEqual({
      tone: 'error',
      title: 'Listing update failed',
      message: 'A valid Shopify REST Product ID is required to update an approved listing.',
    })
  })

  it('returns the success notice after updating the listing', async () => {
    const syncExistingShopifyListing = vi.fn(async () => {})

    const result = await updateApprovedShopifyListing({
      existingProductId: ' 123 ',
      record: createRecord(),
    }, {
      syncExistingShopifyListing,
      describeError: (error) => String(error),
    })

    expect(syncExistingShopifyListing).toHaveBeenCalledWith(expect.objectContaining({ id: 'rec_1' }), 123)
    expect(result).toEqual({
      tone: 'success',
      title: 'Shopify listing updated',
      message: 'Listing #123 was updated with the latest saved fields.',
    })
  })

  it('returns the failure notice when the update throws', async () => {
    const result = await updateApprovedShopifyListing({
      existingProductId: '123',
      record: createRecord(),
    }, {
      syncExistingShopifyListing: vi.fn(async () => {
        throw new Error('timeout')
      }),
      describeError: (error) => error instanceof Error ? `described: ${error.message}` : String(error),
    })

    expect(result).toEqual({
      tone: 'error',
      title: 'Shopify listing update failed',
      message: 'described: timeout',
    })
  })
})