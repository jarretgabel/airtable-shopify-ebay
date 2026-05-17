import type { ReactNode } from 'react';
import { AppPageStatGrid, type AppPageStatItem } from '@/components/app/AppPageStatGrid';

interface AppPageStatSectionProps {
  stats: AppPageStatItem[];
  actions?: ReactNode;
  className?: string;
  dividerBelow?: boolean;
}

export function AppPageStatSection({
  stats,
  actions,
  className,
  dividerBelow = false,
}: AppPageStatSectionProps) {
  return (
    <div className={[
      'flex flex-col gap-4',
      dividerBelow ? 'border-b border-[var(--line)] pb-4' : '',
      className ?? '',
    ].join(' ').trim()}>
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      <AppPageStatGrid stats={stats} />
    </div>
  );
}