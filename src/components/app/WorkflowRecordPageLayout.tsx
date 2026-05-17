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
        className={[
          'space-y-5 bg-[color:color-mix(in_srgb,var(--panel)_94%,transparent)] shadow-[0_1px_2px_rgba(17,32,49,0.05),0_3px_12px_rgba(17,32,49,0.04)]',
          contentClassName ?? '',
        ].join(' ').trim()}
      >
        {children}
      </AppPageSectionSurface>
    </AppPageLayout>
  );
}
