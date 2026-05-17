import type { ReactNode } from 'react';

interface PageTitleHeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
}

export function PageTitleHeader({
  title,
  actions,
  className,
  actionsClassName,
}: PageTitleHeaderProps) {
  return (
    <header className={`py-1 ${className ?? ''}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.35rem] font-extrabold text-[var(--ink)]">{title}</h2>
        </div>
        {actions && <div className={actionsClassName ?? 'flex items-center gap-2'}>{actions}</div>}
      </div>
    </header>
  );
}