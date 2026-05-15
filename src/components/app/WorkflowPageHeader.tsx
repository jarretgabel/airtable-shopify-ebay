import type { ReactNode } from 'react';
import { InfoHint } from '@/components/app/InfoHint';

interface WorkflowPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  descriptionHint?: string;
  detail?: ReactNode;
  actions?: ReactNode;
}

export function WorkflowPageHeader({
  eyebrow,
  title,
  description,
  descriptionHint,
  detail,
  actions,
}: WorkflowPageHeaderProps) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel)_96%,transparent),color-mix(in_srgb,var(--bg)_88%,transparent))] px-5 py-5 shadow-[0_20px_45px_rgba(2,6,23,0.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{title}</h2>
          <div className="mt-3 flex items-start gap-2">
            <p className="m-0 text-sm leading-6 text-[var(--muted)]">{description}</p>
            {descriptionHint ? <InfoHint text={descriptionHint} label={`More about ${title}`} className="mt-1 shrink-0" /> : null}
          </div>
          {detail ? <div className="mt-3 text-sm leading-6 text-[var(--muted)]">{detail}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}