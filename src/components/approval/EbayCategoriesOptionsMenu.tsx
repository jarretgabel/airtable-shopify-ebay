import type { ReactNode } from 'react';
import { type CategoryOption, normalizeSelectionValue } from '@/components/approval/useEbayCategoriesSelect';

interface EbayCategoriesOptionsMenuProps {
  fieldName: string;
  isOpen: boolean;
  query: string;
  isLoading: boolean;
  error: string;
  isBrowseMode: boolean;
  browseStack: CategoryOption[];
  marketplaceId: string;
  options: CategoryOption[];
  normalizedSelectedSet: Set<string>;
  selectedCount: number;
  goToBrowseLevel: (depth: number, activeMarketplaceId: string) => Promise<void>;
  handleBrowseRowClick: (option: CategoryOption) => void;
  toggleSelection: (option: CategoryOption) => void;
}

export function EbayCategoriesOptionsMenu({
  fieldName,
  isOpen,
  query,
  isLoading,
  error,
  isBrowseMode,
  browseStack,
  marketplaceId,
  options,
  normalizedSelectedSet,
  selectedCount,
  goToBrowseLevel,
  handleBrowseRowClick,
  toggleSelection,
}: EbayCategoriesOptionsMenuProps): ReactNode {
  if (!isOpen) return null;

  const activeMarketplaceId = marketplaceId.trim().toUpperCase() || 'EBAY_US';

  return (
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
              void goToBrowseLevel(0, activeMarketplaceId);
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
                  void goToBrowseLevel(browseStack.length - 1, activeMarketplaceId);
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
        const browseDisabled = !selected && selectedCount >= 2;
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
  );
}