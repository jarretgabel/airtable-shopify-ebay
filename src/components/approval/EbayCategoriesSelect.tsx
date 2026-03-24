import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getEbayChildCategories,
  getEbayRootCategories,
  searchEbayCategorySuggestions,
  type EbayCategorySuggestion,
  type EbayCategoryTreeNode,
} from '@/services/ebay';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

const cachedSuggestionsByMarketplace = new Map<string, EbayCategorySuggestion[]>();

type CategoryOption = {
  id: string;
  name: string;
  path: string;
  level: number;
  hasChildren: boolean;
};

function normalizeSelectionValue(value: string): string {
  return value.trim().toLowerCase();
}

function toCategoryOption(item: EbayCategorySuggestion | EbayCategoryTreeNode): CategoryOption {
  return {
    id: item.id,
    name: item.name,
    path: item.path,
    level: item.level,
    hasChildren: 'hasChildren' in item ? Boolean(item.hasChildren) : false,
  };
}

function mergeUniqueSuggestions(
  existing: EbayCategorySuggestion[],
  incoming: EbayCategorySuggestion[],
  max = 60,
): EbayCategorySuggestion[] {
  const map = new Map<string, EbayCategorySuggestion>();
  existing.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).slice(0, max);
}

interface EbayCategoriesSelectProps {
  fieldName: string;
  label: string;
  marketplaceId: string;
  value: string[];
  disabled: boolean;
  onChange: (value: string[]) => void;
}

function reorderById(ids: string[], sourceId: string, targetId: string): string[] {
  if (sourceId === targetId) return ids;
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return ids;

  const next = [...ids];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function EbayCategoriesSelect({
  fieldName,
  label,
  marketplaceId,
  value,
  disabled,
  onChange,
}: EbayCategoriesSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [knownCategoriesById, setKnownCategoriesById] = useState<Record<string, CategoryOption>>({});
  const [browseStack, setBrowseStack] = useState<CategoryOption[]>([]);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBrowseMode = query.trim().length === 0;

  const rememberCategories = (items: CategoryOption[]) => {
    if (items.length === 0) return;
    setKnownCategoriesById((current) => {
      const next = { ...current };
      items.forEach((item) => {
        next[item.id] = item;
      });
      return next;
    });
  };

  const loadRootBrowseOptions = async (activeMarketplaceId: string): Promise<void> => {
    const roots = await getEbayRootCategories(activeMarketplaceId);
    const nextOptions = roots.map(toCategoryOption);
    setBrowseStack([]);
    setOptions(nextOptions);
    rememberCategories(nextOptions);
  };

  const loadChildBrowseOptions = async (parent: CategoryOption, activeMarketplaceId: string): Promise<void> => {
    const children = await getEbayChildCategories(parent.id, activeMarketplaceId);
    const nextOptions = children.map(toCategoryOption);
    setBrowseStack((current) => [...current, parent]);
    setOptions(nextOptions);
    rememberCategories(nextOptions);
  };

  const goToBrowseLevel = async (depth: number, activeMarketplaceId: string): Promise<void> => {
    if (depth <= 0) {
      await loadRootBrowseOptions(activeMarketplaceId);
      return;
    }

    const targetStack = browseStack.slice(0, depth);
    const parent = targetStack[targetStack.length - 1];
    if (!parent) {
      await loadRootBrowseOptions(activeMarketplaceId);
      return;
    }

    const children = await getEbayChildCategories(parent.id, activeMarketplaceId);
    const nextOptions = children.map(toCategoryOption);
    setBrowseStack(targetStack);
    setOptions(nextOptions);
    rememberCategories(nextOptions);
  };

  useEffect(() => () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || disabled) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        const activeMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';

        if (!query.trim()) {
          setError('');
          setIsLoading(true);
          try {
            if (browseStack.length > 0) {
              const parent = browseStack[browseStack.length - 1];
              const children = await getEbayChildCategories(parent.id, activeMarketplaceId);
              const nextOptions = children.map(toCategoryOption);
              if (!cancelled) {
                setOptions(nextOptions);
                rememberCategories(nextOptions);
              }
            } else {
              await loadRootBrowseOptions(activeMarketplaceId);
            }
          } catch (browseError) {
            if (!cancelled) {
              setOptions([]);
              setError(browseError instanceof Error ? browseError.message : 'Unable to load eBay categories.');
            }
          } finally {
            if (!cancelled) setIsLoading(false);
          }
          return;
        }

        setIsLoading(true);
        setError('');

        try {
          const matches = await searchEbayCategorySuggestions(query.trim(), activeMarketplaceId);
          if (!cancelled) {
            const mapped = matches.map(toCategoryOption);
            setOptions(mapped);
            const cacheKey = activeMarketplaceId;
            const cached = cachedSuggestionsByMarketplace.get(cacheKey) ?? [];
            cachedSuggestionsByMarketplace.set(cacheKey, mergeUniqueSuggestions(cached, matches));
            rememberCategories(mapped);
          }
        } catch (searchError) {
          if (!cancelled) {
            setOptions([]);
            setError(searchError instanceof Error ? searchError.message : 'Unable to load eBay categories.');
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      })();
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [browseStack, disabled, isOpen, marketplaceId, query]);

  const normalizedSelectedSet = useMemo(
    () => new Set(value.map((item) => normalizeSelectionValue(item))),
    [value],
  );
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    Object.values(knownCategoriesById).forEach((option) => {
      map.set(option.id, option);
      map.set(normalizeSelectionValue(option.name), option);
    });
    options.forEach((option) => {
      map.set(option.id, option);
      map.set(normalizeSelectionValue(option.name), option);
    });
    return map;
  }, [knownCategoriesById, options]);

  const openMenu = () => {
    if (disabled) return;
    if (!query.trim()) {
      void loadRootBrowseOptions(marketplaceId.trim().toUpperCase() || 'EBAY_US');
    } else {
      const cached = cachedSuggestionsByMarketplace.get(marketplaceId.trim().toUpperCase() || 'EBAY_US') ?? [];
      if (cached.length > 0) {
        setOptions(cached.map(toCategoryOption));
        setError('');
      }
    }
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setQuery('');
    setBrowseStack([]);
  };

  const toggleSelection = (option: CategoryOption) => {
    const optionNameKey = normalizeSelectionValue(option.name);
    const optionIdKey = normalizeSelectionValue(option.id);
    const isSelected = normalizedSelectedSet.has(optionNameKey) || normalizedSelectedSet.has(optionIdKey);

    const nextValues = isSelected
      ? value.filter((item) => {
          const key = normalizeSelectionValue(item);
          return key !== optionNameKey && key !== optionIdKey;
        })
      : [...value, option.name];

    onChange(nextValues.slice(0, 2));
  };

  const reorderSelections = (sourceId: string, targetId: string) => {
    const nextIds = reorderById(value, sourceId, targetId);
    if (nextIds === value) return;
    onChange(nextIds.slice(0, 2));
  };

  const handleBrowseRowClick = (option: CategoryOption) => {
    if (option.hasChildren) {
      void loadChildBrowseOptions(option, marketplaceId.trim().toUpperCase() || 'EBAY_US');
      return;
    }
    toggleSelection(option);
  };

  return (
    <div className="relative col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>{label}</span>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 mb-2 text-xs text-[var(--muted)]">
          Select up to 2 categories. First = primary category, second = secondary category.
        </p>
        <p className="m-0 mb-2 text-xs text-[var(--muted)]">
          Drag selected items to reorder.
        </p>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          {value.length === 0 && (
            <span className="text-sm text-[var(--muted)]">No categories selected.</span>
          )}
          {value.map((selectedValue) => {
            const option = categoryMap.get(selectedValue) ?? categoryMap.get(normalizeSelectionValue(selectedValue));
            const chipLabel = option?.name || selectedValue;
            return (
              <span
                key={selectedValue}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-100 ${dragOverCategoryId === selectedValue ? 'ring-2 ring-sky-300/60' : ''}`}
                draggable={!disabled}
                onDragStart={(event) => {
                  if (disabled) return;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', selectedValue);
                  setDraggingCategoryId(selectedValue);
                }}
                onDragOver={(event) => {
                  if (disabled || !draggingCategoryId || draggingCategoryId === selectedValue) return;
                  event.preventDefault();
                  setDragOverCategoryId(selectedValue);
                }}
                onDrop={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData('text/plain') || draggingCategoryId;
                  if (!sourceId) return;
                  reorderSelections(sourceId, selectedValue);
                  setDraggingCategoryId(null);
                  setDragOverCategoryId(null);
                }}
                onDragEnd={() => {
                  setDraggingCategoryId(null);
                  setDragOverCategoryId(null);
                }}
              >
                <span className="truncate">
                  {chipLabel}
                </span>
                <button
                  type="button"
                  className="rounded-full text-sky-100/80 transition-colors hover:text-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    if (option) {
                      toggleSelection(option);
                      return;
                    }
                    onChange(value.filter((item) => item !== selectedValue));
                  }}
                  disabled={disabled}
                  aria-label={`Remove category ${chipLabel}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            className={inputBaseClass}
            type="text"
            value={query}
            placeholder="Search eBay categories"
            disabled={disabled}
            onFocus={openMenu}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeMenu();
                return;
              }

              if (event.key === 'Enter' && options.length > 0) {
                event.preventDefault();
                toggleSelection(options[0]);
              }
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => {
                closeMenu();
              }, 120);
            }}
            aria-label={label}
            aria-expanded={isOpen}
            aria-controls={`${fieldName}-ebay-category-options`}
            aria-autocomplete="list"
          />
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsOpen((current) => !current)}
            disabled={disabled}
            aria-label="Toggle eBay categories"
            aria-expanded={isOpen}
          >
            ▼
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onChange([])}
            disabled={disabled || value.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id={`${fieldName}-ebay-category-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
          role="listbox"
          aria-multiselectable="true"
        >
          {!query.trim() && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Type to search eBay category suggestions.</p>
          )}
          {isLoading && <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Loading eBay categories...</p>}
          {!isLoading && error && <p className="m-0 px-2 py-2 text-sm text-rose-300">{error}</p>}
          {!isLoading && !error && query.trim() && options.length === 0 && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">No eBay categories matched that search.</p>
          )}
          {!isLoading && !error && isBrowseMode && (
            <div className="mb-1 flex items-center gap-2 px-2 py-1 text-xs text-[var(--muted)]">
              <button
                type="button"
                className="rounded border border-[var(--line)] px-2 py-0.5 transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  void goToBrowseLevel(0, marketplaceId.trim().toUpperCase() || 'EBAY_US');
                }}
                disabled={browseStack.length === 0}
              >
                Root
              </button>
              {browseStack.length > 0 && (
                <>
                  <button
                    type="button"
                    className="rounded border border-[var(--line)] px-2 py-0.5 transition hover:border-[var(--accent)]"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      void goToBrowseLevel(browseStack.length - 1, marketplaceId.trim().toUpperCase() || 'EBAY_US');
                    }}
                  >
                    Back
                  </button>
                  <span className="truncate">{browseStack.map((node) => node.name).join(' > ')}</span>
                </>
              )}
            </div>
          )}
          {!isLoading && !error && options.map((option) => {
            const selected = normalizedSelectedSet.has(normalizeSelectionValue(option.name))
              || normalizedSelectedSet.has(normalizeSelectionValue(option.id));
            const browseDisabled = !selected && value.length >= 2;
            return (
              <div key={option.id} className={`mb-1 flex items-center gap-2 rounded-lg px-2 py-1 ${selected ? 'bg-white/10' : 'hover:bg-white/10'}`}>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 flex-col rounded px-2 py-1 text-left transition"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (isBrowseMode) {
                      handleBrowseRowClick(option);
                    } else {
                      toggleSelection(option);
                    }
                  }}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="text-sm text-[var(--ink)]">
                    {option.name}
                    {isBrowseMode && option.hasChildren ? ' >' : ''}
                  </span>
                  <span className="text-[0.72rem] text-[var(--muted)]">{option.path || option.id}</span>
                </button>
                <button
                  type="button"
                  className="rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggleSelection(option)}
                  disabled={browseDisabled}
                >
                  {selected ? 'Selected' : 'Select'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
