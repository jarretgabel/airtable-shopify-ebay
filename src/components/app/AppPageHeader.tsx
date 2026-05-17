import type { ReactNode } from 'react';

interface AppPageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
}

export function AppPageHeader({
  eyebrow,
  title,
  description,
  detail,
  actions,
  className,
  actionsClassName,
}: AppPageHeaderProps) {
  return (
    <header className={`py-1 ${className ?? ''}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          {eyebrow ? <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p> : null}
          <h2 className={`${eyebrow ? 'mt-2' : 'mt-0'} text-3xl font-semibold text-[var(--ink)]`.trim()}>{title}</h2>
          {description ? <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{description}</div> : null}
          {detail ? <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
        </div>
        {actions ? <div className={actionsClassName ?? 'flex flex-wrap gap-2'}>{actions}</div> : null}
      </div>
    </header>
  );
}