import { createNewShopifyListingRecord } from '@/components/approval/shopifyListingCreation'
import type { AirtableRecord } from '@/types/airtable'

function createRecord(id: string): AirtableRecord {
  return {
    id,
    fields: {},
    createdTime: '2026-04-27T00:00:00.000Z',
  }
}

describe('shopifyListingCreation', () => {
  it('creates a record with the first usable title field', async () => {
    const createRecordMock = vi.fn(async () => createRecord('rec_1'))

    const result = await createNewShopifyListingRecord({
      defaultTitle: 'New Shopify Listing 2026-04-27',
      tableReference: 'tblApproval',
      tableName: 'Approval',
      titleCandidates: ['  ', 'Title', 'Title'],
    }, {
      createRecord: createRecordMock,
    })

    expect(createRecordMock).toHaveBeenCalledTimes(1)
    expect(createRecordMock).toHaveBeenCalledWith(
      'tblApproval',
      'Approval',
      { Title: 'New Shopify Listing 2026-04-27' },
      { typecast: true },
    )
    expect(result.id).toBe('rec_1')
  })

  it('falls back to the next title field when Airtable rejects the first one', async () => {
    const createRecordMock = vi.fn()
      .mockRejectedValueOnce(new Error('Unknown field'))
      .mockResolvedValueOnce(createRecord('rec_2'))

    const result = await createNewShopifyListingRecord({
      defaultTitle: 'New Shopify Listing 2026-04-27',
      tableReference: 'tblApproval',
      tableName: 'Approval',
      titleCandidates: ['Product Title', 'Title'],
    }, {
      createRecord: createRecordMock,
    })

    expect(createRecordMock).toHaveBeenNthCalledWith(
      1,
      'tblApproval',
      'Approval',
      { 'Product Title': 'New Shopify Listing 2026-04-27' },
      { typecast: true },
    )
    expect(createRecordMock).toHaveBeenNthCalledWith(
      2,
      'tblApproval',
      'Approval',
      { Title: 'New Shopify Listing 2026-04-27' },
      { typecast: true },
    )
    expect(result.id).toBe('rec_2')
  })

  it('throws the last Airtable error when all title field attempts fail', async () => {
    const createRecordMock = vi.fn()
      .mockRejectedValueOnce(new Error('Unknown field'))
      .mockRejectedValueOnce(new Error('Permission denied'))

    await expect(createNewShopifyListingRecord({
      defaultTitle: 'New Shopify Listing 2026-04-27',
      tableReference: 'tblApproval',
      tableName: 'Approval',
      titleCandidates: ['Product Title', 'Title'],
    }, {
      createRecord: createRecordMock,
    })).rejects.toThrow('Permission denied')
  })
})