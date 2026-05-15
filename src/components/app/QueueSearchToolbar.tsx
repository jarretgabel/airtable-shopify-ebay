import { RefreshIconButton } from '@/components/app/RefreshIconButton';

export interface QueueSearchToolbarSortOption {
  value: string;
  label: string;
}

export interface QueueSearchToolbarProps {
  searchAriaLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  refreshLabel: string;
  refreshLoadingLabel: string;
  refreshing?: boolean;
  onRefresh: () => void;
  sortAriaLabel?: string;
  sortValue?: string;
  sortOptions?: QueueSearchToolbarSortOption[];
  onSortChange?: (value: string) => void;
  className?: string;
}

const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

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
  className,
}: QueueSearchToolbarProps) {
  const showSort = typeof sortValue === 'string' && Array.isArray(sortOptions) && sortOptions.length > 0 && typeof onSortChange === 'function' && typeof sortAriaLabel === 'string';

  return (
    <div className={['flex flex-col gap-3 lg:flex-row lg:items-center', className ?? ''].join(' ').trim()}>
      <label className="min-w-[240px] flex-1">
        <span className="sr-only">{searchAriaLabel}</span>
        <input
          type="text"
          className={inputClassName}
          value={searchValue}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <RefreshIconButton
          onClick={onRefresh}
          disabled={refreshing}
          loading={refreshing}
          label={refreshLabel}
          loadingLabel={refreshLoadingLabel}
        />
        {showSort ? (
          <div className="relative h-10 w-10 shrink-0">
            <div
              aria-hidden="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)]"
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
      </div>
    </div>
  );
}