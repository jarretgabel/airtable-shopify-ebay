import { generateListingCategoryQueries, pickListingCategory, pickListingCollections, pickListingTags, type ListingTagSuggestions, type CategoryCandidate } from '@/services/app-api/ai';
import { searchEbayCategorySuggestions } from '@/services/app-api/ebay';
import { collectRuleTagVocabulary } from '@/services/shopifyCollectionRules';
import { getCollections, searchTaxonomyCategories } from '@/services/app-api/shopify';
import { getCachedShopifyCollections, setCachedShopifyCollections } from '@/components/approval/shopifyCollectionsCache';

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

// Smart collections are rule-based, so products can't be added to them directly.
export async function loadShopifyCollections() {
  let collections = getCachedShopifyCollections();
  if (!collections) {
    collections = await getCollections(250);
    setCachedShopifyCollections(collections);
  }
  return collections;
}

export async function suggestShopifyCollections(fields: Record<string, string>): Promise<SuggestedCategory[]> {
  const collections = await loadShopifyCollections();

  const manual = collections.filter((collection) => !collection.isSmartCollection);
  const pickedIds = await pickListingCollections(fields, manual.map((collection) => ({ id: collection.id, label: collection.title })));
  return pickedIds
    .map((id) => manual.find((collection) => collection.id === id))
    .filter((collection): collection is NonNullable<typeof collection> => Boolean(collection))
    .map((collection) => ({ id: collection.id, label: collection.title }));
}

// Suggests tags the smart collection rules look for, tags already used on store products (added server-side),
// and a few brand-new tags, which the caller should mark for review.
export async function suggestShopifyTags(fields: Record<string, string>): Promise<ListingTagSuggestions> {
  const vocabulary = collectRuleTagVocabulary(await loadShopifyCollections());
  return pickListingTags(fields, vocabulary);
}
