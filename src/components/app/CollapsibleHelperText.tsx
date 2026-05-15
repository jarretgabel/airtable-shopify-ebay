import type { ReactNode } from 'react';

interface CollapsibleHelperTextProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function CollapsibleHelperText({
  label = 'How this works',
  children,
  className = '',
}: CollapsibleHelperTextProps) {
  return (
    <div className={`rounded-xl border border-[var(--line)]/80 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg)_84%,transparent),color-mix(in_srgb,var(--panel)_88%,transparent))] px-4 py-3 text-sm text-[var(--muted)] shadow-[0_10px_24px_rgba(2,6,23,0.12)] ${className}`.trim()}>
      <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]/90">{label}</p>
      <div className="mt-1.5 leading-6">{children}</div>
    </div>
  );
}