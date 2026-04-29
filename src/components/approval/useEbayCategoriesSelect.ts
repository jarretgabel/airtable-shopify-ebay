import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEbayChildCategories,
  getEbayRootCategories,
  searchEbayCategorySuggestions,
  type EbayCategorySuggestion,
  type EbayCategoryTreeNode,
} from '@/services/app-api/ebay';

const cachedSuggestionsByMarketplace = new Map<string, EbayCategorySuggestion[]>();

export type CategoryOption = {
  id: string;
  name: string;
  path: string;
  level: number;
  hasChildren: boolean;
};

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

export function normalizeSelectionValue(value: string): string {
  return value.trim().toLowerCase();
}

interface UseEbayCategoriesSelectParams {
  marketplaceId: string;
  value: string[];
  labelsById: Record<string, string>;
  disabled: boolean;
  onChange: (value: string[], labelsById?: Record<string, string>) => void;
}

export function useEbayCategoriesSelect({
  marketplaceId,
  value,
  labelsById,
  disabled,
  onChange,
}: UseEbayCategoriesSelectParams) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [knownCategoriesById, setKnownCategoriesById] = useState<Record<string, CategoryOption>>({});
  const [browseStack, setBrowseStack] = useState<CategoryOption[]>([]);
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);

  const isBrowseMode = query.trim().length === 0;

  const rememberCategories = useCallback((items: CategoryOption[]) => {
    if (items.length === 0) return;
    setKnownCategoriesById((current) => {
      const next = { ...current };
      items.forEach((item) => {
        next[item.id] = item;
      });
      return next;
    });
  }, []);

  const loadRootBrowseOptions = useCallback(async (activeMarketplaceId: string): Promise<void> => {
    const roots = await getEbayRootCategories(activeMarketplaceId);
    const nextOptions = roots.map(toCategoryOption);
    setBrowseStack([]);
    setOptions(nextOptions);
    rememberCategories(nextOptions);
  }, [rememberCategories]);

  const loadChildBrowseOptions = useCallback(async (parent: CategoryOption, activeMarketplaceId: string): Promise<void> => {
    const children = await getEbayChildCategories(parent.id, activeMarketplaceId);
    const nextOptions = children.map(toCategoryOption);
    setBrowseStack((current) => [...current, parent]);
    setOptions(nextOptions);
    rememberCategories(nextOptions);
  }, [rememberCategories]);

  const goToBrowseLevel = useCallback(async (depth: number, activeMarketplaceId: string): Promise<void> => {
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
  }, [browseStack, loadRootBrowseOptions, rememberCategories]);

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
            const cached = cachedSuggestionsByMarketplace.get(activeMarketplaceId) ?? [];
            cachedSuggestionsByMarketplace.set(activeMarketplaceId, mergeUniqueSuggestions(cached, matches));
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
  }, [browseStack, disabled, isOpen, loadRootBrowseOptions, marketplaceId, query, rememberCategories]);

  const normalizedSelectedSet = useMemo(
    () => new Set(value.map((item) => normalizeSelectionValue(item))),
    [value],
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryOption>();
    Object.entries(labelsById).forEach(([id, name]) => {
      const option = { id, name, path: name, level: 0, hasChildren: false };
      map.set(id, option);
      map.set(normalizeSelectionValue(name), option);
    });
    Object.values(knownCategoriesById).forEach((option) => {
      map.set(option.id, option);
      map.set(normalizeSelectionValue(option.name), option);
    });
    options.forEach((option) => {
      map.set(option.id, option);
      map.set(normalizeSelectionValue(option.name), option);
    });
    return map;
  }, [knownCategoriesById, labelsById, options]);

  const buildLabelMap = useCallback((ids: string[]): Record<string, string> => {
    const nextLabelsById: Record<string, string> = {};
    ids.forEach((id) => {
      const option = categoryMap.get(id) ?? categoryMap.get(normalizeSelectionValue(id));
      if (option?.name) {
        nextLabelsById[id] = option.name;
      }
    });
    return nextLabelsById;
  }, [categoryMap]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    const activeMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';
    if (!query.trim()) {
      void loadRootBrowseOptions(activeMarketplaceId);
    } else {
      const cached = cachedSuggestionsByMarketplace.get(activeMarketplaceId) ?? [];
      if (cached.length > 0) {
        setOptions(cached.map(toCategoryOption));
        setError('');
      }
    }
    setIsOpen(true);
  }, [disabled, loadRootBrowseOptions, marketplaceId, query]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setBrowseStack([]);
  }, []);

  const toggleSelection = useCallback((option: CategoryOption) => {
    const optionNameKey = normalizeSelectionValue(option.name);
    const optionIdKey = normalizeSelectionValue(option.id);
    const isSelected = normalizedSelectedSet.has(optionNameKey) || normalizedSelectedSet.has(optionIdKey);

    const nextValues = isSelected
      ? value.filter((item) => {
          const key = normalizeSelectionValue(item);
          return key !== optionNameKey && key !== optionIdKey;
        })
      : [...value, option.id];

    const limitedValues = nextValues.slice(0, 2);
    onChange(limitedValues, buildLabelMap(limitedValues));
  }, [buildLabelMap, normalizedSelectedSet, onChange, value]);

  const reorderSelections = useCallback((sourceId: string, targetId: string) => {
    const nextIds = reorderById(value, sourceId, targetId);
    if (nextIds === value) return;
    const limitedValues = nextIds.slice(0, 2);
    onChange(limitedValues, buildLabelMap(limitedValues));
  }, [buildLabelMap, onChange, value]);

  const handleBrowseRowClick = useCallback((option: CategoryOption) => {
    if (option.hasChildren) {
      void loadChildBrowseOptions(option, marketplaceId.trim().toUpperCase() || 'EBAY_US');
      return;
    }
    toggleSelection(option);
  }, [loadChildBrowseOptions, marketplaceId, toggleSelection]);

  return {
    browseStack,
    categoryMap,
    closeMenu,
    dragOverCategoryId,
    draggingCategoryId,
    error,
    goToBrowseLevel,
    handleBrowseRowClick,
    isBrowseMode,
    isLoading,
    isOpen,
    normalizedSelectedSet,
    openMenu,
    options,
    query,
    reorderSelections,
    setDragOverCategoryId,
    setDraggingCategoryId,
    setIsOpen,
    setQuery,
    toggleSelection,
  };
}