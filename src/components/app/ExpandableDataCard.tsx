import { ReactNode } from 'react';

interface ExpandableDataCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  side?: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function ExpandableDataCard({ title, subtitle, side, expanded, onToggle, children }: ExpandableDataCardProps) {
  return (
    <article className="mt-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_6px_20px_rgba(17,32,49,0.06)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full bg-[var(--panel)] px-4 py-4 text-left transition hover:bg-[var(--line)]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h3 className="m-0 text-[1.08rem] font-semibold text-[var(--ink)]">{title}</h3>
            {subtitle && <div className="mt-1.5 text-sm text-[var(--muted)]">{subtitle}</div>}
          </div>
          {side && <div className="text-left md:text-right">{side}</div>}
        </div>
      </button>
      {expanded && children && (
        <div className="border-t border-[var(--line)] bg-[var(--bg)] px-4 py-4">{children}</div>
      )}
    </article>
  );
}
