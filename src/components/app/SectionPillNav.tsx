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
      ? 'border-[var(--accent)]/55 bg-[var(--accent-soft-bg)] text-[var(--accent-soft-ink)] shadow-[0_8px_18px_rgba(0,94,203,0.14)]'
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
        'overflow-x-auto rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-3 shadow-[var(--elevation-lg)] backdrop-blur-md',
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