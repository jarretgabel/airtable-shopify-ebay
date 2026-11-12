import type { ReactNode } from 'react';

interface AppPageHeaderProps {
  /** Kept for callers; the top-bar breadcrumb already shows the group. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
}

export function AppPageHeader({
  title,
  description,
  detail,
  actions,
  className,
  actionsClassName,
}: AppPageHeaderProps) {
  return (
    <header className={`pb-1 ${className ?? ''}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="mt-0 text-[1.65rem] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
          {description ? <div className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</div> : null}
          {detail ? <div className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
        </div>
        {actions ? <div className={actionsClassName ?? 'flex flex-wrap gap-2'}>{actions}</div> : null}
      </div>
    </header>
  );
}