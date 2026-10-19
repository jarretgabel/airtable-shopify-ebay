import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EbayCategoriesOptionsMenu } from '@/components/approval/EbayCategoriesOptionsMenu';
import {
  normalizeSelectionValue,
  useEbayCategoriesSelect,
} from '@/components/approval/useEbayCategoriesSelect';
import { collectAiListingFields } from '@/components/approval/aiListingFields';
import { useRegisterCategorySuggester } from '@/components/approval/aiCategorySuggesterRegistry';
import { suggestEbayCategory } from '@/services/categorySuggestions';

const inputBaseClass =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-70';
const labelClass = 'mb-1 block text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]';
const requiredBadgeClass = 'inline-block rounded-full border border-[var(--required-badge-border)] bg-[var(--required-badge-bg)] px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.06em] text-[var(--required-badge-ink)]';

interface EbayCategoriesSelectProps {
  fieldName: string;
  label: string;
  required?: boolean;
  marketplaceId: string;
  value: string[];
  disabled: boolean;
  labelsById?: Record<string, string>;
  onChange: (value: string[], labelsById?: Record<string, string>) => void;
  helperWarning?: ReactNode;
  formValues?: Record<string, string>;
}

export function EbayCategoriesSelect({
  fieldName,
  label,
  required = false,
  marketplaceId,
  value,
  disabled,
  labelsById = {},
  onChange,
  helperWarning,
  formValues,
}: EbayCategoriesSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');
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
    selectedCategoryLabels,
    toggleSelection,
  } = useEbayCategoriesSelect({
    marketplaceId,
    value,
    labelsById,
    disabled,
    onChange,
  });
  const suggestCategory = async (fields: Record<string, string>, onlyIfEmpty: boolean) => {
    if (onlyIfEmpty && value.length > 0) return;

    setIsSuggesting(true);
    setSuggestError('');
    try {
      const suggestion = await suggestEbayCategory(fields, marketplaceId);
      if (!suggestion) {
        setSuggestError('AI could not find a matching eBay category. Browse or search for one manually.');
        return;
      }
      // Replace only the primary category; a secondary category incurs extra fees, so it stays as chosen.
      const nextIds = [suggestion.id, ...value.filter((item) => item !== suggestion.id).slice(0, 1)];
      onChange(nextIds, { [suggestion.id]: suggestion.label.split(' > ').pop() ?? suggestion.label });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSuggestClick = async () => {
    try {
      await suggestCategory(collectAiListingFields(formValues ?? {}, [fieldName]), false);
    } catch (error) {
      setSuggestError(error instanceof Error ? error.message : 'Could not suggest a category.');
    }
  };

  // "Generate all with AI" only fills the category when none is selected yet.
  useRegisterCategorySuggester('ebay-category', (fields) => suggestCategory(fields, true));

  const missingRequiredSelection = required && value.length === 0;
  const inputClassName = missingRequiredSelection
    ? `${inputBaseClass} border-rose-400/45 bg-rose-500/5 focus:border-rose-300`
    : inputBaseClass;

  useEffect(() => {
    if (!isOpen) return;

    const isOutsideRoot = (target: EventTarget | null): boolean => {
      const node = target as Node | null;
      return Boolean(node && rootRef.current && !rootRef.current.contains(node));
    };

    const handleDocumentMouseDown = (event: MouseEvent) => {
      if (isOutsideRoot(event.target)) {
        closeMenu();
      }
    };

    const handleDocumentFocusIn = (event: FocusEvent) => {
      if (isOutsideRoot(event.target)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleDocumentMouseDown);
    document.addEventListener('focusin', handleDocumentFocusIn);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      document.removeEventListener('focusin', handleDocumentFocusIn);
    };
  }, [closeMenu, isOpen]);

  return (
    <div ref={rootRef} className="relative col-span-1 flex flex-col gap-2 md:col-span-2">
      <span className={`${labelClass} flex items-center gap-2 ${missingRequiredSelection ? 'text-[var(--required-label-ink)]' : ''}`}>
        <span>{label}</span>
        {required && <span className={requiredBadgeClass}>eBay Required</span>}
        {formValues && (
          <button
            type="button"
            className="ml-auto rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[0.68rem] font-semibold normal-case tracking-normal text-[var(--ink)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => { void handleSuggestClick(); }}
            disabled={disabled || isSuggesting}
          >
            {isSuggesting ? 'Suggesting…' : 'Suggest with AI'}
          </button>
        )}
      </span>
      {suggestError && <span role="alert" className="text-xs text-rose-400">{suggestError}</span>}

      <div className={`rounded-xl border p-3 ${missingRequiredSelection ? 'border-rose-400/45 bg-rose-500/5' : 'border-[var(--line)] bg-[var(--panel)]'}`}>
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
            <span className={`text-sm ${missingRequiredSelection ? 'text-rose-200' : 'text-[var(--muted)]'}`}>
              No categories selected.
            </span>
          )}
          {value.map((selectedValue, index) => {
            const option = categoryMap.get(selectedValue) ?? categoryMap.get(normalizeSelectionValue(selectedValue));
            const chipLabel = selectedCategoryLabels[index] || option?.name || selectedValue;
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
            className={inputClassName}
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
            aria-label={label}
            aria-expanded={isOpen}
            aria-controls={`${fieldName}-ebay-category-options`}
            aria-autocomplete="list"
            aria-invalid={missingRequiredSelection || undefined}
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
