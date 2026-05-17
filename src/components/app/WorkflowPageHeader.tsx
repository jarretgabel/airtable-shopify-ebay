import type { ReactNode } from 'react';

interface WorkflowPageHeaderProps {
  eyebrow: string;
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
}

export function WorkflowPageHeader({
  eyebrow,
  title,
  detail,
  actions,
}: WorkflowPageHeaderProps) {
  return (
    <section className="py-1">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{title}</h2>
          {detail ? <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}