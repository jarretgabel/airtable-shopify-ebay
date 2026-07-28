interface SortableColumnLabelProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  direction?: 'asc' | 'desc' | null;
  ariaLabel?: string;
}

export function SortableColumnLabel({
  label,
  onClick,
  active = false,
  direction = null,
  ariaLabel,
}: SortableColumnLabelProps) {
  const upTone = direction === 'asc'
    ? 'text-[var(--accent)]'
    : active
      ? 'text-[var(--ink)]/50'
      : 'text-[var(--muted)]/55';
  const downTone = direction === 'desc'
    ? 'text-[var(--accent)]'
    : active
      ? 'text-[var(--ink)]/50'
      : 'text-[var(--muted)]/55';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Sort by ${label}`}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] font-semibold transition',
        active
          ? 'text-[var(--ink)]'
          : 'text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]',
      ].join(' ')}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className="inline-flex h-3.5 w-2.5 flex-col items-center justify-center leading-none"
      >
        <svg viewBox="0 0 10 10" className={['h-3 w-3 transition-colors', upTone].join(' ')}>
          <path d="M5 2 L8 6 H2 Z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 10 10" className={['-mt-0.5 h-3 w-3 transition-colors', downTone].join(' ')}>
          <path d="M2 4 H8 L5 8 Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );
}
