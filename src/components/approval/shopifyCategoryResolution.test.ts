import {
  resolveShopifyCategoryIdWithFeedback,
  type ShopifyCategoryResolutionState,
} from '@/components/approval/shopifyCategoryResolution'

function createState(overrides: Partial<ShopifyCategoryResolutionState> = {}): ShopifyCategoryResolutionState {
  return {
    status: 'idle',
    match: null,
    error: '',
    ...overrides,
  }
}

describe('shopifyCategoryResolution', () => {
  it('returns the explicit category id without resolving', async () => {
    const resolveCategory = vi.fn()
    const setState = vi.fn()

    const result = await resolveShopifyCategoryIdWithFeedback(' gid://shopify/TaxonomyCategory/el-2 ', 'audio', {
      currentState: createState(),
      describeError: (error) => String(error),
      resolveCategory,
      setState,
    })

    expect(result).toBe('gid://shopify/TaxonomyCategory/el-2')
    expect(resolveCategory).not.toHaveBeenCalled()
    expect(setState).not.toHaveBeenCalled()
  })

  it('returns undefined when no lookup value is available', async () => {
    const resolveCategory = vi.fn()

    const result = await resolveShopifyCategoryIdWithFeedback('', '   ', {
      currentState: createState(),
      describeError: (error) => String(error),
      resolveCategory,
      setState: vi.fn(),
    })

    expect(result).toBeUndefined()
    expect(resolveCategory).not.toHaveBeenCalled()
  })

  it('reuses the cached match and avoids resetting state', async () => {
    const match = { id: 'gid://shopify/TaxonomyCategory/el-2', fullName: 'Electronics > Audio', name: 'Audio', isLeaf: true }
    const resolveCategory = vi.fn()
    const setState = vi.fn()

    const result = await resolveShopifyCategoryIdWithFeedback('', 'audio', {
      currentState: createState({ status: 'resolved', match }),
      describeError: (error) => String(error),
      resolveCategory,
      setState,
    })

    expect(result).toBe(match.id)
    expect(resolveCategory).not.toHaveBeenCalled()
    expect(setState).not.toHaveBeenCalled()
  })

  it('marks the category as unresolved and warns when no match is found', async () => {
    const pushNotice = vi.fn()
    const setState = vi.fn()

    const result = await resolveShopifyCategoryIdWithFeedback('', 'audio breadcrumb', {
      currentState: createState(),
      describeError: (error) => String(error),
      pushNotice,
      resolveCategory: vi.fn(async () => null),
      setState,
    })

    expect(result).toBeUndefined()
    expect(setState).toHaveBeenCalledWith({
      status: 'unresolved',
      match: null,
      error: '',
    })
    expect(pushNotice).toHaveBeenCalledWith(
      'warning',
      'Shopify category not resolved',
      'Could not resolve a Shopify taxonomy category from "audio breadcrumb". Continuing without category assignment.',
    )
  })

  it('marks the category as errored and warns when resolution throws', async () => {
    const pushNotice = vi.fn()
    const setState = vi.fn()

    const result = await resolveShopifyCategoryIdWithFeedback('', 'audio breadcrumb', {
      currentState: createState(),
      describeError: (error) => error instanceof Error ? `described: ${error.message}` : String(error),
      pushNotice,
      resolveCategory: vi.fn(async () => {
        throw new Error('timeout')
      }),
      setState,
    })

    expect(result).toBeUndefined()
    expect(setState).toHaveBeenCalledWith({
      status: 'error',
      match: null,
      error: 'timeout',
    })
    expect(pushNotice).toHaveBeenCalledWith(
      'warning',
      'Shopify category resolution failed',
      'described: timeout Continuing without category assignment.',
    )
  })
})