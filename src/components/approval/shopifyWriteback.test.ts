import {
  buildShopifyProductIdWritebackAttempts,
  writeShopifyProductIdToAirtable,
} from '@/components/approval/shopifyWriteback'

describe('shopifyWriteback', () => {
  it('tries numeric then string writeback for numeric product ids', () => {
    expect(buildShopifyProductIdWritebackAttempts('Shopify REST Product ID', 12345)).toEqual([
      { 'Shopify REST Product ID': 12345 },
      { 'Shopify REST Product ID': '12345' },
    ])
  })

  it('uses only string writeback when the product id is not numeric', () => {
    expect(buildShopifyProductIdWritebackAttempts('Shopify REST Product ID', 'gid://shopify/Product/1')).toEqual([
      { 'Shopify REST Product ID': 'gid://shopify/Product/1' },
    ])
  })

  it('stops after numeric writeback succeeds', async () => {
    const updateRecord = vi.fn(async () => {})

    const result = await writeShopifyProductIdToAirtable({
      fieldName: 'Shopify REST Product ID',
      productId: 12345,
      recordId: 'rec1',
      tableReference: 'app1/tbl1',
      tableName: 'Listings',
    }, { updateRecord })

    expect(updateRecord).toHaveBeenCalledTimes(1)
    expect(updateRecord).toHaveBeenCalledWith('app1/tbl1', 'Listings', 'rec1', {
      'Shopify REST Product ID': 12345,
    })
    expect(result).toEqual({
      productId: '12345',
      wrote: true,
      lastError: null,
    })
  })

  it('falls back to string writeback when numeric writeback fails', async () => {
    const updateRecord = vi.fn()
      .mockRejectedValueOnce(new Error('numeric rejected'))
      .mockResolvedValueOnce(undefined)

    const result = await writeShopifyProductIdToAirtable({
      fieldName: 'Shopify REST Product ID',
      productId: 12345,
      recordId: 'rec1',
      tableReference: 'app1/tbl1',
      tableName: 'Listings',
    }, { updateRecord })

    expect(updateRecord).toHaveBeenCalledTimes(2)
    expect(updateRecord).toHaveBeenNthCalledWith(1, 'app1/tbl1', 'Listings', 'rec1', {
      'Shopify REST Product ID': 12345,
    })
    expect(updateRecord).toHaveBeenNthCalledWith(2, 'app1/tbl1', 'Listings', 'rec1', {
      'Shopify REST Product ID': '12345',
    })
    expect(result).toEqual({
      productId: '12345',
      wrote: true,
      lastError: null,
    })
  })

  it('returns the last error when all writeback attempts fail', async () => {
    const finalError = new Error('string rejected')
    const updateRecord = vi.fn()
      .mockRejectedValueOnce(new Error('numeric rejected'))
      .mockRejectedValueOnce(finalError)

    const result = await writeShopifyProductIdToAirtable({
      fieldName: 'Shopify REST Product ID',
      productId: 12345,
      recordId: 'rec1',
      tableReference: 'app1/tbl1',
      tableName: 'Listings',
    }, { updateRecord })

    expect(result).toEqual({
      productId: '12345',
      wrote: false,
      lastError: finalError,
    })
  })
})