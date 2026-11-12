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
    '-mb-px inline-flex outline-none focus:outline-none focus-visible:outline-none items-center border-b-2 px-3 py-2 text-[0.8rem] font-semibold transition',
    active
      ? 'border-[var(--accent)] text-[var(--ink)]'
      : 'border-transparent text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--ink)]',
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
        'overflow-x-auto border-b border-[var(--line)]',
        className ?? '',
      ].join(' ').trim()}
    >
      <div className="flex min-w-max items-center gap-1">
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