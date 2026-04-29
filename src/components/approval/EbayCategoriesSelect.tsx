import { useEffect, useRef, type ReactNode } from 'react';
import { EbayCategoriesOptionsMenu } from '@/components/approval/EbayCategoriesOptionsMenu';
import {
  normalizeSelectionValue,
  useEbayCategoriesSelect,
} from '@/components/approval/useEbayCategoriesSelect';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';

interface EbayCategoriesSelectProps {
  fieldName: string;
  label: string;
  marketplaceId: string;
  value: string[];
  disabled: boolean;
  labelsById?: Record<string, string>;
  onChange: (value: string[], labelsById?: Record<string, string>) => void;
  helperWarning?: ReactNode;
}

export function EbayCategoriesSelect({
  fieldName,
  label,
  marketplaceId,
  value,
  disabled,
  labelsById = {},
  onChange,
  helperWarning,
}: EbayCategoriesSelectProps) {
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
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
  } = useEbayCategoriesSelect({
    marketplaceId,
    value,
    labelsById,
    disabled,
    onChange,
  });

  useEffect(() => () => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
    }
  }, []);

  return (
    <div className="relative col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={labelClass}>{label}</span>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="m-0 mb-2 text-xs text-[var(--muted)]">
          Select up to 2 categories. First = primary category, second = secondary category.
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <p className="m-0 text-[var(--muted)]">
            Drag selected items to reorder.
          </p>
          {helperWarning}
        </div>

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
                className={`inline-flex max-w-full items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-sm font-medium text-[var(--ink)] shadow-[0_0_0_1px_rgba(14,165,233,0.08)] ${dragOverCategoryId === selectedValue ? 'ring-2 ring-sky-400/45' : ''}`}
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
                  className="rounded-full text-[var(--ink)]/65 transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
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

      <EbayCategoriesOptionsMenu
        fieldName={fieldName}
        isOpen={isOpen}
        query={query}
        isLoading={isLoading}
        error={error}
        isBrowseMode={isBrowseMode}
        browseStack={browseStack}
        marketplaceId={marketplaceId}
        options={options}
        normalizedSelectedSet={normalizedSelectedSet}
        selectedCount={value.length}
        goToBrowseLevel={goToBrowseLevel}
        handleBrowseRowClick={handleBrowseRowClick}
        toggleSelection={toggleSelection}
      />
    </div>
  );
}
