import type { ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';

interface WorkflowRecordPageLayoutProps {
  eyebrow?: string;
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
  belowHeader?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function WorkflowRecordPageLayout({
  eyebrow,
  title,
  detail,
  actions,
  belowHeader,
  children,
  contentClassName,
}: WorkflowRecordPageLayoutProps) {
  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow={eyebrow}
        title={title}
        detail={detail}
        actions={actions}
      />
      {belowHeader}
      <AppPageSectionSurface
        flat
        className={['space-y-8', contentClassName ?? ''].join(' ').trim()}
      >
        {children}
      </AppPageSectionSurface>
    </AppPageLayout>
  );
}
