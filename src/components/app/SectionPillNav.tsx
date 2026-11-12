interface SectionPillNavItem<T extends string> {
  key: T;
  label: string;
}

interface SectionPillNavProps<T extends string> {
  ariaLabel: string;
  items: SectionPillNavItem<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  className?: string;
}

function sectionButtonClass(active: boolean): string {
  return [
    'inline-flex items-center rounded-full border px-3 py-1.5 text-[0.74rem] font-semibold transition',
    active
      ? 'border-[var(--accent)]/55 bg-[var(--accent-soft-bg)] text-[var(--accent-soft-ink)] '
      : 'border-[var(--line)] bg-[var(--surface-veil-soft)] text-[var(--muted)] hover:border-[var(--line)]/80 hover:bg-[var(--surface-veil)] hover:text-[var(--ink)]',
  ].join(' ');
}

export function SectionPillNav<T extends string>({
  ariaLabel,
  items,
  activeKey,
  onSelect,
  className,
}: SectionPillNavProps<T>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={[
        'overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 shadow-[0_4px_14px_rgba(2,6,23,0.12)]',
        className ?? '',
      ].join(' ').trim()}
    >
      <div className="flex min-w-max items-center gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={sectionButtonClass(item.key === activeKey)}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}