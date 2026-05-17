import type { ReactNode } from 'react';
import { AppPageHeader } from '@/components/app/AppPageHeader';

interface PageTitleHeaderProps {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  className?: string;
  actionsClassName?: string;
}

export function PageTitleHeader({
  eyebrow,
  title,
  actions,
  className,
  actionsClassName,
}: PageTitleHeaderProps) {
  return <AppPageHeader eyebrow={eyebrow} title={title} actions={actions} className={className} actionsClassName={actionsClassName} />;
}