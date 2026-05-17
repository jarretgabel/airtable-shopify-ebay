import type { ReactNode } from 'react';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';

interface WorkflowQueuePageTemplateProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
}

export function WorkflowQueuePageTemplate({
  eyebrow,
  title,
  children,
}: WorkflowQueuePageTemplateProps) {
  return (
    <>
      <div className="mt-3 mb-6">
        <WorkflowPageHeader
          eyebrow={eyebrow}
          title={title}
        />
      </div>

      {children}
    </>
  );
}