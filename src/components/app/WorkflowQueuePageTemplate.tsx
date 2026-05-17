import type { ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';

interface WorkflowQueuePageTemplateProps {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}

export function WorkflowQueuePageTemplate({
  eyebrow,
  title,
  children,
}: WorkflowQueuePageTemplateProps) {
  return (
    <AppPageLayout>
      <div>
        <WorkflowPageHeader
          eyebrow={eyebrow}
          title={title}
        />
      </div>

      {children}
    </AppPageLayout>
  );
}