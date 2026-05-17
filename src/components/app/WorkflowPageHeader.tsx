import type { ReactNode } from 'react';
import { AppPageHeader } from '@/components/app/AppPageHeader';

interface WorkflowPageHeaderProps {
  eyebrow?: string;
  title: string;
  detail?: ReactNode;
  actions?: ReactNode;
}

export function WorkflowPageHeader({
  eyebrow,
  title,
  detail,
  actions,
}: WorkflowPageHeaderProps) {
  return <AppPageHeader eyebrow={eyebrow} title={title} detail={detail} actions={actions} />;
}