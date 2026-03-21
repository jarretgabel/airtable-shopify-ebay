import type { ReactNode } from 'react';

interface PageTitleHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
}

export function PageTitleHeader({
  title,
  description,
  actions,
  className,
  descriptionClassName,
  actionsClassName,
}: PageTitleHeaderProps) {
  return (
    <header className={`rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 ${className ?? ''}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.35rem] font-extrabold text-[var(--ink)]">{title}</h2>
          {description && (
            <p className={`mt-2 text-[0.9rem] leading-relaxed text-[var(--muted)] ${descriptionClassName ?? ''}`.trim()}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className={actionsClassName ?? 'flex items-center gap-2'}>{actions}</div>}
      </div>
    </header>
  );
}