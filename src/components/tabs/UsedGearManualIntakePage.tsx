import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
}

export function UsedGearManualIntakePage({ recordId }: UsedGearManualIntakePageProps) {
  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow={recordId ? 'Intake' : 'Intake Forms'}
        title={recordId ? 'Intake Record' : 'Manual Intake'}
      />

      <AirtableEmbeddedForm recordId={recordId} />
    </AppPageLayout>
  );
}
