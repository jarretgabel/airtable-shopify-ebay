import type { ReactNode } from 'react';

interface AppSectionTitleProps {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function AppSectionTitle({
  title,
  actions,
  className,
  titleClassName,
}: AppSectionTitleProps) {
  return (
    <div className={[
      'flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 pt-1',
      className ?? '',
    ].join(' ').trim()}>
      <h2 className={[
        'm-0 text-[1.05rem] font-semibold text-[var(--ink)]',
        titleClassName ?? '',
      ].join(' ').trim()}>
        {title}
      </h2>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}