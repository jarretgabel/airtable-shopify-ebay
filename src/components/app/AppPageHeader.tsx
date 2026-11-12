import { createContext, useContext, type ReactNode } from 'react';

/** Lets a wrapper place a control in the page header's action area. */
export const PageSubNavContext = createContext<ReactNode>(null);

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
  const subNav = useContext(PageSubNavContext);
  return (
    <>
    <header className={`pb-1 ${className ?? ''}`.trim()}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h2 className="mt-0 text-[1.65rem] font-bold leading-tight tracking-[-0.02em] text-[var(--ink)]">{title}</h2>
          {description ? <div className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{description}</div> : null}
          {detail ? <div className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
        </div>
        {actions || subNav ? <div className={actionsClassName ?? 'flex flex-wrap items-center gap-2'}>{subNav}{actions}</div> : null}
      </div>
    </header>
    </>
  );
}