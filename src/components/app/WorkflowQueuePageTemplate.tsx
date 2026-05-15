import type { ReactNode } from 'react';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';

interface WorkflowQueuePageTemplateProps {
  eyebrow: string;
  title: string;
  description: string;
  descriptionHint?: string;
  children: ReactNode;
}

export function WorkflowQueuePageTemplate({
  eyebrow,
  title,
  description,
  descriptionHint,
  children,
}: WorkflowQueuePageTemplateProps) {
  return (
    <>
      <div className="mt-3 mb-6">
        <WorkflowPageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          descriptionHint={descriptionHint}
        />
      </div>

      {children}
    </>
  );
}