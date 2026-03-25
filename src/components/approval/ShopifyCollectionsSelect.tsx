import { useEffect, useMemo, useRef, useState } from 'react';
import { shopifyService, type ShopifyCollectionMatch } from '@/services/shopify';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

interface ShopifyCollectionsSelectProps {
  fieldName: string;
  label: string;
  value: string[];
  labelsById?: Record<string, string>;
  disabled: boolean;
  onChange: (value: string[], labelsById?: Record<string, string>) => void;
}

function collectionShortId(collectionId: string): string {
  return collectionId.split('/').pop() ?? collectionId;
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

export function ShopifyCollectionsSelect({
  fieldName,
  label,
  value,
  labelsById = {},
  disabled,
  onChange,
}: ShopifyCollectionsSelectProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<ShopifyCollectionMatch[]>([]);
  const [knownCollectionsById, setKnownCollectionsById] = useState<Record<string, ShopifyCollectionMatch>>({});
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setIsLoading(true);
        setError('');

        try {
          const matches = await shopifyService.searchCollections(query.trim());
          if (!cancelled) {
            setOptions(matches);
            setKnownCollectionsById((current) => {
              const next = { ...current };
              matches.forEach((match) => {
                next[match.id] = match;
              });
              return next;
            });
          }
        } catch (searchError) {
          if (!cancelled) {
            setOptions([]);
            setError(searchError instanceof Error ? searchError.message : 'Unable to load Shopify collections.');
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

  useEffect(() => {
    if (value.length === 0) return;

    const missingIds = value.filter((collectionId) => !labelsById[collectionId] && !knownCollectionsById[collectionId]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const collections = await shopifyService.getCollections(250);
        if (cancelled) return;

        const resolvedById = Object.fromEntries(collections.map((collection) => [collection.id, collection]));
        setKnownCollectionsById((current) => ({
          ...resolvedById,
          ...current,
        }));
      } catch {
        // Keep editor usable even if Shopify collection hydration fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [knownCollectionsById, labelsById, value]);

  const selectedCollectionSet = useMemo(() => new Set(value), [value]);
  const collectionMap = useMemo(() => {
    const map = new Map<string, ShopifyCollectionMatch>();
    Object.entries(labelsById).forEach(([id, title]) => {
      map.set(id, { id, title, handle: '' });
    });
    Object.values(knownCollectionsById).forEach((option) => {
      map.set(option.id, option);
    });
    options.forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [knownCollectionsById, labelsById, options]);

  const buildLabelMap = (ids: string[]): Record<string, string> => {
    const labels: Record<string, string> = {};
    ids.forEach((collectionId) => {
      const match = collectionMap.get(collectionId);
      if (match?.title) {
        labels[collectionId] = match.title;
      }
    });
    return labels;
  };

  const openMenu = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setQuery('');
  };

  const toggleSelection = (collectionId: string) => {
    const nextIds = selectedCollectionSet.has(collectionId)
      ? value.filter((id) => id !== collectionId)
      : [...value, collectionId];

    onChange(nextIds, buildLabelMap(nextIds));
  };

  const reorderSelections = (sourceId: string, targetId: string) => {
    const nextIds = reorderById(value, sourceId, targetId);
    if (nextIds === value) return;
    onChange(nextIds, buildLabelMap(nextIds));
  };

  return (
    <div className="relative col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>{label}</span>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 mb-2 text-xs text-[var(--muted)]">
          Drag selected items to reorder.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {value.length === 0 && (
            <span className="text-sm text-[var(--muted)]">No collections selected.</span>
          )}
          {value.map((collectionId) => {
            const option = collectionMap.get(collectionId);
            return (
              <span
                key={collectionId}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-sm text-blue-100 ${dragOverCollectionId === collectionId ? 'ring-2 ring-blue-300/60' : ''}`}
                draggable={!disabled}
                onDragStart={(event) => {
                  if (disabled) return;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', collectionId);
                  setDraggingCollectionId(collectionId);
                }}
                onDragOver={(event) => {
                  if (disabled || !draggingCollectionId || draggingCollectionId === collectionId) return;
                  event.preventDefault();
                  setDragOverCollectionId(collectionId);
                }}
                onDrop={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                  const sourceId = event.dataTransfer.getData('text/plain') || draggingCollectionId;
                  if (!sourceId) return;
                  reorderSelections(sourceId, collectionId);
                  setDraggingCollectionId(null);
                  setDragOverCollectionId(null);
                }}
                onDragEnd={() => {
                  setDraggingCollectionId(null);
                  setDragOverCollectionId(null);
                }}
              >
                <span className="truncate">
                  {option?.title || `Collection ${collectionShortId(collectionId)}`}
                </span>
                <button
                  type="button"
                  className="rounded-full text-blue-100/80 transition-colors hover:text-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => toggleSelection(collectionId)}
                  disabled={disabled}
                  aria-label={`Remove collection ${option?.title || collectionShortId(collectionId)}`}
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
            placeholder="Search Shopify collections"
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
                toggleSelection(options[0].id);
              }
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => {
                closeMenu();
              }, 120);
            }}
            aria-label={label}
            aria-expanded={isOpen}
            aria-controls={`${fieldName}-collection-options`}
            aria-autocomplete="list"
          />
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setIsOpen((current) => !current)}
            disabled={disabled}
            aria-label="Toggle Shopify collections"
            aria-expanded={isOpen}
          >
            ▼
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onChange([], {})}
            disabled={disabled || value.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id={`${fieldName}-collection-options`}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_20px_45px_rgba(15,23,42,0.4)]"
          role="listbox"
          aria-multiselectable="true"
        >
          {isLoading && <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">Loading Shopify collections...</p>}
          {!isLoading && error && <p className="m-0 px-2 py-2 text-sm text-rose-300">{error}</p>}
          {!isLoading && !error && options.length === 0 && (
            <p className="m-0 px-2 py-2 text-sm text-[var(--muted)]">No Shopify collections matched that search.</p>
          )}
          {!isLoading && !error && options.map((option) => {
            const selected = selectedCollectionSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition hover:bg-white/10 ${selected ? 'bg-white/10' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => toggleSelection(option.id)}
                role="option"
                aria-selected={selected}
              >
                <span className="text-sm text-[var(--ink)]">{option.title}</span>
                <span className="text-[0.72rem] text-[var(--muted)]">
                  {option.handle ? `/${option.handle}` : 'No handle'} · {collectionShortId(option.id)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
