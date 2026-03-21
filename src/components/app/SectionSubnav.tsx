interface SectionSubnavItem<T extends string> {
  key: T;
  label: string;
  detail: string;
}

interface SectionSubnavProps<T extends string> {
  title?: string;
  ariaLabel: string;
  items: Array<SectionSubnavItem<T>>;
  onSelect: (key: T) => void;
}

export function SectionSubnav<T extends string>({
  title = 'On this page',
  ariaLabel,
  items,
  onSelect,
}: SectionSubnavProps<T>) {
  return (
    <aside className="h-fit rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:sticky lg:top-4">
      <p className="px-2 pb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{title}</p>
      <nav aria-label={ariaLabel} className="space-y-1">
        {items.map((item) => {
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className="w-full rounded-xl border border-transparent bg-white/[0.02] px-3 py-2 text-left transition hover:border-cyan-400/45 hover:bg-cyan-500/10"
            >
              <span className="block text-[0.8rem] font-semibold text-[var(--ink)]">{item.label}</span>
              <span className="block text-[0.72rem] text-[var(--muted)]">{item.detail}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}