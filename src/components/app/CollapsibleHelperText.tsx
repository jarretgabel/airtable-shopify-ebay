import { useId, useState, type ReactNode } from 'react';

interface CollapsibleHelperTextProps {
  label?: string;
  children: ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

export function CollapsibleHelperText({
  label = 'How this works',
  children,
  className = '',
  defaultExpanded,
}: CollapsibleHelperTextProps) {
  const rootClassName = `rounded-xl border border-[var(--line)]/80 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg)_84%,transparent),color-mix(in_srgb,var(--panel)_88%,transparent))] px-4 py-3 text-sm text-[var(--muted)] shadow-[0_10px_24px_rgba(2,6,23,0.12)] ${className}`.trim();

  if (defaultExpanded === undefined) {
    return (
      <div className={rootClassName}>
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]/90">{label}</p>
        <div className="mt-1.5 leading-6">{children}</div>
      </div>
    );
  }

  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={rootClassName}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 rounded-lg text-left transition hover:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]/90">{label}</span>
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)]">
          <span>{expanded ? 'Hide' : 'Show'}</span>
          <span className={`text-sm transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">▾</span>
        </span>
      </button>

      {expanded ? <div id={contentId} className="mt-3 leading-6">{children}</div> : null}
    </div>
  );
}