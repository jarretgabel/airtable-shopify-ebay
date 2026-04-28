import {
  ensureShopifyDraftBeforeApproval,
  type EnsureShopifyDraftBeforeApprovalDependencies,
} from '@/components/approval/shopifyDraftApproval'
import type { AirtableRecord } from '@/types/airtable'
import type { ShopifyProduct } from '@/types/shopify'

function createRecord(): AirtableRecord {
  return {
    id: 'rec_1',
    fields: {},
    createdTime: '2026-04-27T00:00:00.000Z',
  }
}

function createProduct(): ShopifyProduct {
  return {
    title: 'Draft product',
    status: 'draft',
    variants: [{ price: '10.00' }],
  }
}

function createDependencies() {
  const dependencies = {
    getShopifyProduct: vi.fn(async (): Promise<unknown> => null),
    syncExistingShopifyListing: vi.fn(async () => {}),
    describeError: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
    resolveShopifyCategoryId: vi.fn(async () => 'gid://shopify/TaxonomyCategory/1'),
    upsertShopifyProductWithCollectionFallback: vi.fn(async () => ({ id: 101 })),
    writeShopifyProductIdToAirtable: vi.fn(async () => ({ productId: '101', wrote: true, lastError: null as unknown | null })),
  } satisfies EnsureShopifyDraftBeforeApprovalDependencies

  return dependencies
}

describe('shopifyDraftApproval', () => {
  it('updates an existing draft and returns both notices', async () => {
    const dependencies = createDependencies()
    dependencies.getShopifyProduct.mockResolvedValueOnce({ id: 123 })

    const result = await ensureShopifyDraftBeforeApproval({
      existingProductId: '123',
      productIdFieldName: 'Shopify REST Product ID',
      createPayload: createProduct(),
      record: createRecord(),
      collectionIds: ['gid://shopify/Collection/1'],
      tableReference: 'tblApproval',
      tableName: 'Approval',
    }, dependencies)

    expect(result.status).toBe('existing-updated')
    expect(result.notices.map((notice) => notice.title)).toEqual([
      'Shopify draft updated',
      'Shopify draft already exists',
    ])
    expect(dependencies.syncExistingShopifyListing).toHaveBeenCalledWith(expect.objectContaining({ id: 'rec_1' }), 123)
  })

  it('returns an update failure notice when syncing an existing draft fails', async () => {
    const dependencies = createDependencies()
    dependencies.getShopifyProduct.mockResolvedValueOnce({ id: 123 })
    dependencies.syncExistingShopifyListing.mockRejectedValueOnce(new Error('timeout'))

    const result = await ensureShopifyDraftBeforeApproval({
      existingProductId: '123',
      productIdFieldName: 'Shopify REST Product ID',
      createPayload: createProduct(),
      record: createRecord(),
      collectionIds: [],
      tableReference: 'tblApproval',
      tableName: 'Approval',
    }, dependencies)

    expect(result.status).toBe('update-failed')
    expect(result.notices).toEqual([
      {
        tone: 'error',
        title: 'Shopify draft update failed',
        message: 'timeout',
      },
    ])
  })

  it('clears a stale product id, creates a new draft, and writes back the new id', async () => {
    const dependencies = createDependencies()

    const result = await ensureShopifyDraftBeforeApproval({
      existingProductId: '123',
      productIdFieldName: 'Shopify REST Product ID',
      createPayload: createProduct(),
      record: createRecord(),
      collectionIds: ['gid://shopify/Collection/1'],
      tableReference: 'tblApproval',
      tableName: 'Approval',
    }, dependencies)

    expect(result.status).toBe('created')
    expect(result.createdProductId).toBe(101)
    expect(result.nextProductIdFieldValue).toBe('101')
    expect(result.notices.map((notice) => notice.title)).toEqual([
      'Cleared stale Shopify product ID',
      'Shopify draft created',
    ])
  })

  it('creates a new draft from an invalid product id and keeps the field cleared when writeback fails', async () => {
    const dependencies = createDependencies()
    dependencies.writeShopifyProductIdToAirtable.mockResolvedValueOnce({ productId: '101', wrote: false, lastError: new Error('writeback failed') })

    const result = await ensureShopifyDraftBeforeApproval({
      existingProductId: 'invalid',
      productIdFieldName: 'Shopify REST Product ID',
      createPayload: createProduct(),
      record: createRecord(),
      collectionIds: [],
      tableReference: 'tblApproval',
      tableName: 'Approval',
    }, dependencies)

    expect(result.status).toBe('created')
    expect(result.nextProductIdFieldValue).toBe('')
    expect(result.notices.map((notice) => notice.title)).toEqual([
      'Draft created, ID writeback failed',
      'Shopify draft created',
    ])
  })

  it('returns a creation failure notice when draft creation fails', async () => {
    const dependencies = createDependencies()
    dependencies.upsertShopifyProductWithCollectionFallback.mockRejectedValueOnce(new Error('invalid category'))

    const result = await ensureShopifyDraftBeforeApproval({
      existingProductId: '',
      productIdFieldName: 'Shopify REST Product ID',
      createPayload: createProduct(),
      record: createRecord(),
      collectionIds: [],
      tableReference: 'tblApproval',
      tableName: 'Approval',
    }, dependencies)

    expect(result.status).toBe('creation-failed')
    expect(result.notices).toEqual([
      {
        tone: 'error',
        title: 'Shopify draft creation failed',
        message: 'invalid category',
      },
    ])
  })
})