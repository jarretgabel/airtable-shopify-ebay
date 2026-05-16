import type { ReactNode } from 'react';
import { InfoHint } from '@/components/app/InfoHint';

interface PageTitleHeaderProps {
  title: string;
  description?: string;
  descriptionHint?: string;
  actions?: ReactNode;
  className?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
}

export function PageTitleHeader({
  title,
  description,
  descriptionHint,
  actions,
  className,
  descriptionClassName,
  actionsClassName,
}: PageTitleHeaderProps) {
  return (
    <header className={`py-1 ${className ?? ''}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-[1.35rem] font-extrabold text-[var(--ink)]">{title}</h2>
          {(description || descriptionHint) && (
            <div className="mt-2 flex items-start gap-2">
              {description ? (
                <p className={`m-0 text-[0.9rem] leading-relaxed text-[var(--muted)] ${descriptionClassName ?? ''}`.trim()}>
                  {description}
                </p>
              ) : null}
              {descriptionHint ? <InfoHint text={descriptionHint} label={`More about ${title}`} className="mt-0.5 shrink-0" /> : null}
            </div>
          )}
        </div>
        {actions && <div className={actionsClassName ?? 'flex items-center gap-2'}>{actions}</div>}
      </div>
    </header>
  );
}