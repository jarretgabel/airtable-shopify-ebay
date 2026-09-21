import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveTaxonomyCategory, searchTaxonomyCategories } from '@/services/app-api/shopify';
import type { ShopifyTaxonomyCategoryMatch } from '@/services/shopify';
import { trimShopifyProductType } from '@/services/shopifyTaxonomy';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-rose-400/45 bg-rose-500/15 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-rose-200';
const TAXONOMY_MAX_RESULTS = 50;
const TAXONOMY_BROWSE_PREFIXES = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
];

interface TaxonomyIndexCacheEntry {
  loadedAt: number;
  categories: ShopifyTaxonomyCategoryMatch[];
}

const TAXONOMY_INDEX_CACHE_TTL_MS = 10 * 60 * 1000;
let taxonomyIndexCache: TaxonomyIndexCacheEntry | null = null;

function normalizeCategoryPath(value: string): string {
  return value
    .split('>')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(' > ');
}

function toTaxonomyMap(matches: ShopifyTaxonomyCategoryMatch[]): Map<string, ShopifyTaxonomyCategoryMatch> {
  const next = new Map<string, ShopifyTaxonomyCategoryMatch>();
  matches.forEach((match) => {
    if (!match?.id || !match?.fullName) return;
    next.set(match.id, match);
  });
  return next;
}

function sortTaxonomyMatches(matches: ShopifyTaxonomyCategoryMatch[]): ShopifyTaxonomyCategoryMatch[] {
  return [...matches].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

function getCachedTaxonomyIndex(): ShopifyTaxonomyCategoryMatch[] | null {
  if (!taxonomyIndexCache) return null;
  if (Date.now() - taxonomyIndexCache.loadedAt > TAXONOMY_INDEX_CACHE_TTL_MS) {
    taxonomyIndexCache = null;
    return null;
  }

  return taxonomyIndexCache.categories;
}

function setCachedTaxonomyIndex(categories: ShopifyTaxonomyCategoryMatch[]): void {
  taxonomyIndexCache = {
    loadedAt: Date.now(),
    categories: sortTaxonomyMatches(categories),
  };
}

interface ShopifyTaxonomyTypeSelectProps {
  fieldName: string;
  label: string;
  required?: boolean;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

export function ShopifyTaxonomyTypeSelect({
  fieldName,
  label,
  required = false,
  value,
  disabled,
  onChange,
}: ShopifyTaxonomyTypeSelectProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<ShopifyTaxonomyCategoryMatch[]>([]);
  const [isCommittingSelection, setIsCommittingSelection] = useState(false);
  const [knownCategoriesById, setKnownCategoriesById] = useState<Map<string, ShopifyTaxonomyCategoryMatch>>(new Map());
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen || disabled) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        const normalizedQuery = query.trim();
        setIsLoading(true);
        setError('');

        try {
          if (!normalizedQuery) {
            const cachedIndex = getCachedTaxonomyIndex();
            if (cachedIndex) {
              if (cancelled) return;
              setOptions(cachedIndex);
              setKnownCategoriesById((current) => {
                const next = new Map(current);
                cachedIndex.forEach((match) => next.set(match.id, match));
                return next;
              });
              return;
            }

            const grouped = await Promise.all(
              TAXONOMY_BROWSE_PREFIXES.map(async (prefix) => {
                try {
                  return await searchTaxonomyCategories(prefix, TAXONOMY_MAX_RESULTS);
                } catch {
                  return [] as ShopifyTaxonomyCategoryMatch[];
                }
              }),
            );

            if (cancelled) return;

            const mergedMap = toTaxonomyMap(grouped.flat());
            const merged = sortTaxonomyMatches(Array.from(mergedMap.values()));
            setCachedTaxonomyIndex(merged);
            setOptions(merged);
            setKnownCategoriesById((current) => {
              const next = new Map(current);
              merged.forEach((match) => next.set(match.id, match));
              return next;
            });
            return;
          }

          const matches = await searchTaxonomyCategories(normalizedQuery, TAXONOMY_MAX_RESULTS);
          if (cancelled) return;

          setOptions(matches);
          setKnownCategoriesById((current) => {
            const next = new Map(current);
            matches.forEach((match) => next.set(match.id, match));
            return next;
          });
        } catch (searchError) {
          if (!cancelled) {
            setOptions([]);
            setError(searchError instanceof Error ? searchError.message : 'Unable to load Shopify categories.');
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [disabled, isOpen, query]);

  useEffect(() => () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
  }, []);

  const selectedCategory = useMemo(() => {
    const normalizedValue = normalizeCategoryPath(value).toLowerCase();
    if (!normalizedValue) return null;

    const matchedOption = options.find((option) => normalizeCategoryPath(option.fullName).toLowerCase() === normalizedValue);
    if (matchedOption) return matchedOption;

    return Array.from(knownCategoriesById.values())
      .find((option) => normalizeCategoryPath(option.fullName).toLowerCase() === normalizedValue)
      ?? null;
  }, [knownCategoriesById, options, value]);
  const categoryPathSegments = useMemo(
    () => normalizeCategoryPath(value).split('>').map((segment) => segment.trim()).filter(Boolean),
    [value],
  );
  const labelClassName = required ? `${labelClass} text-rose-200` : labelClass;
  const inputClassName = required
    ? `${inputBaseClass} border-rose-400/45 bg-rose-500/5 focus:border-rose-300`
    : inputBaseClass;
  const toggleButtonClassName = required
    ? 'rounded-xl border border-rose-400/45 bg-rose-500/5 px-3 py-2 text-sm text-[var(--ink)] transition hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-70'
    : 'rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70';

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const commitSelection = (nextValue: string) => {
    const normalizedNext = normalizeCategoryPath(nextValue);
    onChange(normalizedNext);
    setQuery(normalizedNext);
    setIsOpen(false);
    setError('');
  };

  const commitTypedQueryIfNeeded = async () => {
    const normalizedQuery = normalizeCategoryPath(query);
    const normalizedValue = normalizeCategoryPath(value);

    if (!normalizedQuery || normalizedQuery.toLowerCase() === normalizedValue.toLowerCase()) {
      setQuery(normalizedValue);
      return;
    }

    const exactMatch = options.find((option) => normalizeCategoryPath(option.fullName).toLowerCase() === normalizedQuery.toLowerCase());
    if (exactMatch) {
      commitSelection(exactMatch.fullName);
      return;
    }

    try {
      setIsCommittingSelection(true);
      const resolved = await resolveTaxonomyCategory(normalizedQuery);
      if (resolved?.fullName?.trim()) {
        commitSelection(resolved.fullName);
        return;
      }

      commitSelection(normalizedQuery);
      setError('Saved your typed value. Pick a suggestion for a fully verified Shopify taxonomy path.');
    } catch {
      commitSelection(normalizedQuery);
      setError('Saved your typed value. Pick a suggestion if you want to validate the exact Shopify taxonomy path.');
    } finally {
      setIsCommittingSelection(false);
    }
  };

  const browseBySegment = (segmentIndex: number) => {
    if (segmentIndex < 0 || segmentIndex >= categoryPathSegments.length) return;
    const partialPath = categoryPathSegments.slice(0, segmentIndex + 1).join(' > ');
    setQuery(`${partialPath} > `);
    setIsOpen(true);
  };

  return (
    <div className="relative flex flex-col gap-2">
      <span className={`${labelClassName} flex items-center gap-2`}>
        <span>{label}</span>
        {required && <span className={requiredBadgeClass}>Required</span>}
      </span>
      <div className="flex items-center gap-2">
        <input
          className={inputClassName}
          type="text"
          value={query}
          placeholder="Search Shopify categories"
          disabled={disabled}
          onFocus={openMenu}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setQuery(normalizeCategoryPath(value));
              closeMenu();
              return;
            }

            if (event.key === 'Enter' && options.length > 0) {
              event.preventDefault();
              commitSelection(options[0].fullName);
            }
          }}
          onBlur={() => {
            blurTimerRef.current = setTimeout(() => {
              void commitTypedQueryIfNeeded();
              closeMenu();
            }, 120);
          }}
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={`${fieldName}-taxonomy-options`}
          aria-autocomplete="list"
        />
        <button
          type="button"
          className={toggleButtonClassName}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (isOpen) {
              void commitTypedQueryIfNeeded();
              closeMenu();
              return;
            }

            openMenu();
          }}
          disabled={disabled}
          aria-label="Toggle Shopify category choices"
          aria-expanded={isOpen}
        >
          ▼
        </button>
      </div>

      {categoryPathSegments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {categoryPathSegments.map((segment, index) => (
            <button
              key={`${segment}:${index}`}
              type="button"
              className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.7rem] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => browseBySegment(index)}
              disabled={disabled}
              aria-label={`Browse deeper from ${segment}`}
            >
              {segment}
            </button>
          ))}
        </div>
      )}

      {selectedCategory && (
        <p className="m-0 text-[0.72rem] text-[var(--muted)]">
          Selected category: <span className="text-[var(--ink)]">{selectedCategory.fullName}</span>{selectedCategory.isLeaf ? ' (leaf)' : ''}
        </p>
      )}

      {isOpen && (
        <div
          id={`${fieldName}-taxonomy-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
          role="listbox"
        >
          {(isLoading || isCommittingSelection) && <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Loading Shopify categories...</p>}
          {!isLoading && error && <p className="m-0 px-2 py-2 text-sm text-rose-300">{error}</p>}
          {!isLoading && !error && options.length === 0 && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">No Shopify categories matched that search.</p>
          )}
          {!isLoading && !error && options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/10 ${option.fullName === value ? 'bg-white/10' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commitSelection(option.fullName)}
              role="option"
              aria-selected={option.fullName === value}
            >
              <span className="text-sm text-[var(--ink)]">{option.fullName}</span>
              <span className="text-[0.72rem] text-[var(--muted)]">
                Product type: {trimShopifyProductType(option.fullName)}{option.isLeaf ? ' · leaf' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
