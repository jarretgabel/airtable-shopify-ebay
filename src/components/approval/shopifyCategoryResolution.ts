import type { ShopifyTaxonomyCategoryMatch } from '@/services/shopify'

export interface ShopifyCategoryResolutionState {
  status: 'idle' | 'resolving' | 'resolved' | 'unresolved' | 'error'
  match: ShopifyTaxonomyCategoryMatch | null
  error: string
}

export interface ShopifyCategoryResolutionDependencies {
  currentState: ShopifyCategoryResolutionState
  describeError: (error: unknown) => string
  pushNotice?: (tone: 'warning', title: string, message: string) => void
  resolveCategory: (lookupValue: string) => Promise<ShopifyTaxonomyCategoryMatch | null>
  setState: (nextState: ShopifyCategoryResolutionState) => void
}

export async function resolveShopifyCategoryIdWithFeedback(
  explicitCategoryId: string | undefined,
  lookupValue: string | undefined,
  dependencies: ShopifyCategoryResolutionDependencies,
): Promise<string | undefined> {
  const normalizedExplicitCategoryId = explicitCategoryId?.trim() || ''
  if (normalizedExplicitCategoryId) return normalizedExplicitCategoryId

  const normalizedLookupValue = lookupValue?.trim() || ''
  if (!normalizedLookupValue) return undefined

  const { currentState, describeError, pushNotice, resolveCategory, setState } = dependencies

  try {
    const match = currentState.match ?? await resolveCategory(normalizedLookupValue)
    if (match) {
      if (currentState.match?.id !== match.id) {
        setState({
          status: 'resolved',
          match,
          error: '',
        })
      }
      return match.id
    }

    setState({
      status: 'unresolved',
      match: null,
      error: '',
    })
    pushNotice?.('warning', 'Shopify category not resolved', `Could not resolve a Shopify taxonomy category from "${normalizedLookupValue}". Continuing without category assignment.`)
    return undefined
  } catch (error) {
    setState({
      status: 'error',
      match: null,
      error: error instanceof Error ? error.message : 'Unable to resolve Shopify taxonomy category.',
    })
    pushNotice?.('warning', 'Shopify category resolution failed', `${describeError(error)} Continuing without category assignment.`)
    return undefined
  }
}