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
      ? 'border-sky-400/60 bg-sky-500/15 text-sky-200 shadow-[0_8px_18px_rgba(56,189,248,0.14)]'
      : 'border-white/10 bg-slate-950/35 text-[var(--muted)] hover:border-white/20 hover:bg-white/5 hover:text-[var(--ink)]',
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
        'overflow-x-auto rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(7,17,28,0.94),rgba(7,17,28,0.82))] px-3 py-3 shadow-[0_18px_40px_rgba(2,6,23,0.35)] backdrop-blur-md',
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