import { generateListingCategoryQueries, pickListingCategory, type CategoryCandidate } from '@/services/app-api/ai';
import { searchEbayCategorySuggestions } from '@/services/app-api/ebay';
import { searchTaxonomyCategories } from '@/services/app-api/shopify';

export interface SuggestedCategory {
  id: string;
  label: string;
}

async function suggestCategory(
  target: 'shopify' | 'ebay',
  fields: Record<string, string>,
  search: (query: string) => Promise<CategoryCandidate[]>,
): Promise<SuggestedCategory | null> {
  const queries = await generateListingCategoryQueries(target, fields);

  let firstError: unknown;
  const runSearches = async (terms: string[]): Promise<CategoryCandidate[]> => {
    const results = await Promise.all(terms.map((term) => search(term).catch((error: unknown) => {
      firstError ??= error;
      return [] as CategoryCandidate[];
    })));
    return results.flat();
  };

  const candidates = new Map<string, CategoryCandidate>();
  const addCandidates = (items: CategoryCandidate[]) => items.forEach((candidate) => {
    if (candidate.id && candidate.label && !candidates.has(candidate.id)) candidates.set(candidate.id, candidate);
  });

  addCandidates(await runSearches(queries));
  if (candidates.size === 0) {
    // Multi-word phrases can miss in category search, so retry with the individual words.
    const words = Array.from(new Set(queries.flatMap((query) => query.split(/\s+/)).filter((word) => word.length > 3)));
    addCandidates(await runSearches(words));
  }
  if (candidates.size === 0 && firstError) throw firstError;

  const list = Array.from(candidates.values());
  const pickedId = await pickListingCategory(target, fields, list);
  return list.find((candidate) => candidate.id === pickedId) ?? null;
}

export function suggestShopifyCategory(fields: Record<string, string>): Promise<SuggestedCategory | null> {
  return suggestCategory('shopify', fields, async (query) => (
    (await searchTaxonomyCategories(query, 10)).map((match) => ({ id: match.id, label: match.fullName }))
  ));
}

export function suggestEbayCategory(fields: Record<string, string>, marketplaceId = 'EBAY_US'): Promise<SuggestedCategory | null> {
  return suggestCategory('ebay', fields, async (query) => (
    (await searchEbayCategorySuggestions(query, marketplaceId)).map((match) => ({ id: match.id, label: match.path }))
  ));
}
