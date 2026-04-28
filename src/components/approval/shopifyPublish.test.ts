import {
  upsertShopifyProductWithCollectionFallback,
  type ShopifyCollectionFallbackDependencies,
} from '@/components/approval/shopifyPublish'
import type {
  ShopifyUnifiedProductResult,
  ShopifyUnifiedProductSetRequest,
  ShopifyUnifiedUpsertWithCollectionsResult,
} from '@/services/shopify'
import type { ShopifyProduct } from '@/types/shopify'

function createProduct(): ShopifyProduct {
  return {
    title: 'Test Product',
    status: 'draft',
    variants: [{ price: '10.00' }],
  }
}

function createDependencies(overrides: Partial<ShopifyCollectionFallbackDependencies> = {}): ShopifyCollectionFallbackDependencies {
  return {
    addProductToCollections: vi.fn(async () => {}),
    buildRequest: vi.fn((product, options) => ({
      input: { title: product.title },
      synchronous: true,
      identifier: options?.existingProductId
        ? { id: `gid://shopify/Product/${options.existingProductId}` }
        : undefined,
    } satisfies ShopifyUnifiedProductSetRequest)),
    describeCollectionJoinFailure: vi.fn((detail: string) => `joined: ${detail}`),
    describeError: vi.fn((error: unknown) => error instanceof Error ? error.message : String(error)),
    pushNotice: vi.fn(),
    upsertExistingProductWithCollections: vi.fn(async () => ({
      product: { id: 101, adminGraphqlApiId: 'gid://shopify/Product/101', title: 'Combined' },
      collectionFailures: [],
    } satisfies ShopifyUnifiedUpsertWithCollectionsResult)),
    upsertProduct: vi.fn(async () => ({
      id: 101,
      adminGraphqlApiId: 'gid://shopify/Product/101',
      title: 'Created',
    } satisfies ShopifyUnifiedProductResult)),
    ...overrides,
  }
}

describe('shopifyPublish', () => {
  it('uses the combined mutation for existing products with collections and retries standalone assignment on collection failures', async () => {
    const dependencies = createDependencies({
      upsertExistingProductWithCollections: vi.fn(async () => ({
        product: { id: 200, adminGraphqlApiId: 'gid://shopify/Product/200', title: 'Updated' },
        collectionFailures: ['gid://shopify/Collection/1: denied'],
      })),
    })

    const result = await upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: [' gid://shopify/Collection/1 ', 'gid://shopify/Collection/1'],
      existingProductId: 200,
    }, dependencies)

    expect(dependencies.upsertExistingProductWithCollections).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: { id: 'gid://shopify/Product/200' } }),
      ['gid://shopify/Collection/1'],
    )
    expect(dependencies.upsertProduct).not.toHaveBeenCalled()
    expect(dependencies.addProductToCollections).toHaveBeenCalledWith(200, ['gid://shopify/Collection/1'])
    expect(dependencies.pushNotice).not.toHaveBeenCalledWith(
      'warning',
      'Some collections were not applied',
      expect.any(String),
    )
    expect(result.id).toBe(200)
  })

  it('warns when combined mutation collection failures also fail standalone fallback assignment', async () => {
    const dependencies = createDependencies({
      addProductToCollections: vi.fn(async () => {
        throw new Error('manual assignment denied')
      }),
      upsertExistingProductWithCollections: vi.fn(async () => ({
        product: { id: 200, adminGraphqlApiId: 'gid://shopify/Product/200', title: 'Updated' },
        collectionFailures: ['gid://shopify/Collection/1: denied'],
      })),
    })

    const result = await upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: ['gid://shopify/Collection/1'],
      existingProductId: 200,
    }, dependencies)

    expect(dependencies.addProductToCollections).toHaveBeenCalledWith(200, ['gid://shopify/Collection/1'])
    expect(dependencies.pushNotice).toHaveBeenCalledWith(
      'warning',
      'Some collections were not applied',
      expect.stringContaining('Fallback collection assignment failed: manual assignment denied'),
    )
    expect(result.id).toBe(200)
  })

  it('creates a product then applies normalized collections separately', async () => {
    const dependencies = createDependencies()

    const result = await upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: [' gid://shopify/Collection/1 ', 'gid://shopify/Collection/1', 'gid://shopify/Collection/2'],
    }, dependencies)

    expect(dependencies.upsertProduct).toHaveBeenCalledTimes(1)
    expect(dependencies.addProductToCollections).toHaveBeenCalledWith(101, ['gid://shopify/Collection/1', 'gid://shopify/Collection/2'])
    expect(result.id).toBe(101)
  })

  it('retries without collections when the unified mutation fails on collection-specific errors', async () => {
    const withCollectionsRequest = { input: { title: 'with collections' }, synchronous: true } satisfies ShopifyUnifiedProductSetRequest
    const withoutCollectionsRequest = { input: { title: 'without collections' }, synchronous: true } satisfies ShopifyUnifiedProductSetRequest
    const dependencies = createDependencies({
      buildRequest: vi.fn((_product, options) => (options?.collectionIds?.length ? withCollectionsRequest : withoutCollectionsRequest)),
      upsertProduct: vi.fn()
        .mockRejectedValueOnce(new Error('Collection ID is invalid'))
        .mockResolvedValueOnce({ id: 303, adminGraphqlApiId: 'gid://shopify/Product/303', title: 'Retried' }),
    })

    const result = await upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: ['gid://shopify/Collection/9'],
    }, dependencies)

    expect(dependencies.upsertProduct).toHaveBeenNthCalledWith(1, withCollectionsRequest)
    expect(dependencies.upsertProduct).toHaveBeenNthCalledWith(2, withoutCollectionsRequest)
    expect(dependencies.addProductToCollections).toHaveBeenCalledWith(303, ['gid://shopify/Collection/9'])
    expect(result.id).toBe(303)
  })

  it('returns the product and warns when standalone collection application fails after save', async () => {
    const dependencies = createDependencies({
      addProductToCollections: vi.fn(async () => {
        throw new Error('manual assignment denied')
      }),
    })

    const result = await upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: ['gid://shopify/Collection/5'],
    }, dependencies)

    expect(result.id).toBe(101)
    expect(dependencies.pushNotice).toHaveBeenCalledWith(
      'warning',
      'Some collections were not applied',
      expect.stringContaining('joined: manual assignment denied'),
    )
  })

  it('rethrows non-collection errors without retrying', async () => {
    const dependencies = createDependencies({
      upsertProduct: vi.fn(async () => {
        throw new Error('rate limit exceeded')
      }),
    })

    await expect(upsertShopifyProductWithCollectionFallback({
      product: createProduct(),
      collectionIds: ['gid://shopify/Collection/5'],
    }, dependencies)).rejects.toThrow('rate limit exceeded')

    expect(dependencies.upsertProduct).toHaveBeenCalledTimes(1)
    expect(dependencies.addProductToCollections).not.toHaveBeenCalled()
  })
})