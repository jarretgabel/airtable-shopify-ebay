import type { ReactNode } from 'react';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';

export interface QueueSearchToolbarSortOption {
  value: string;
  label: string;
}

export interface QueueSearchToolbarFilterOption {
  value: string;
  label: string;
}

export interface QueueSearchToolbarFilter {
  ariaLabel: string;
  value: string;
  options: QueueSearchToolbarFilterOption[];
  onChange: (value: string) => void;
}

export interface QueueSearchToolbarProps {
  searchAriaLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  refreshLabel?: string;
  refreshLoadingLabel?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  sortAriaLabel?: string;
  sortValue?: string;
  sortOptions?: QueueSearchToolbarSortOption[];
  onSortChange?: (value: string) => void;
  filters?: QueueSearchToolbarFilter[];
  compactFilters?: boolean;
  actions?: ReactNode;
  className?: string;
}

const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
const filterSelectClassName = 'h-[42px] min-w-[220px] rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

function SortIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M4.167 5.417h9.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4.167 10h6.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4.167 14.583h4.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M14.583 4.167v11.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="m12.5 6.25 2.083-2.083 2.084 2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12.5 13.75 2.083 2.083 2.084-2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d="M3.75 5.417h12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M6.25 10h7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M8.75 14.583h2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const iconButtonShellClassName = 'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)]';

export function QueueSearchToolbar({
  searchAriaLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  refreshLabel,
  refreshLoadingLabel,
  refreshing = false,
  onRefresh,
  sortAriaLabel,
  sortValue,
  sortOptions,
  onSortChange,
  filters,
  compactFilters = false,
  actions,
  className,
}: QueueSearchToolbarProps) {
  const showSort = typeof sortValue === 'string' && Array.isArray(sortOptions) && sortOptions.length > 0 && typeof onSortChange === 'function' && typeof sortAriaLabel === 'string';
  const showRefresh = typeof onRefresh === 'function' && typeof refreshLabel === 'string' && typeof refreshLoadingLabel === 'string';
  const visibleFilters = Array.isArray(filters) ? filters : [];

  return (
    <div className={['flex flex-col gap-3 lg:flex-row lg:items-center', className ?? ''].join(' ').trim()}>
      <label className="relative min-w-[240px] flex-1">
        <span className="sr-only">{searchAriaLabel}</span>
        <input
          type="text"
          className={[inputClassName, searchValue ? 'pr-9' : ''].join(' ').trim()}
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
        />
        {searchValue ? (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted)] transition hover:text-[var(--ink)]"
            onClick={() => onSearchChange('')}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </label>
      {visibleFilters.length > 0 && !compactFilters ? (
        <div className="flex flex-wrap items-center gap-3">
          {visibleFilters.map((filter) => (
            <select
              key={filter.ariaLabel}
              aria-label={filter.ariaLabel}
              className={filterSelectClassName}
              value={filter.value}
              onChange={(event) => filter.onChange(event.currentTarget.value)}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
        {showRefresh ? (
          <RefreshIconButton
            onClick={onRefresh}
            disabled={refreshing}
            loading={refreshing}
            label={refreshLabel}
            loadingLabel={refreshLoadingLabel}
          />
        ) : null}
        {visibleFilters.length > 0 && compactFilters ? visibleFilters.map((filter) => (
          <div key={filter.ariaLabel} className="relative h-10 w-10 shrink-0">
            <div aria-hidden="true" className={iconButtonShellClassName}>
              <FilterIcon />
            </div>
            <select
              aria-label={filter.ariaLabel}
              className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
              value={filter.value}
              onChange={(event) => filter.onChange(event.currentTarget.value)}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        )) : null}
        {showSort ? (
          <div className="relative h-10 w-10 shrink-0">
            <div
              aria-hidden="true"
              className={iconButtonShellClassName}
            >
              <SortIcon />
            </div>
            <select
              aria-label={sortAriaLabel}
              className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
              value={sortValue}
              onChange={(event) => onSortChange(event.currentTarget.value)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        ) : null}
        {actions}
      </div>
    </div>
  );
}