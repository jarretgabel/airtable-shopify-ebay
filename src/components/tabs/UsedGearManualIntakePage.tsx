import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
  backToDirectoryLabel?: string;
  eyebrow?: string;
}

export function UsedGearManualIntakePage({
  recordId,
  onBackToDirectory,
  backToDirectoryLabel = 'Back to Intake Directory',
  eyebrow = 'Intake',
}: UsedGearManualIntakePageProps) {
  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow={eyebrow}
        title={recordId ? 'Intake Record' : 'Create Intake Item'}
        actions={recordId && onBackToDirectory ? (
          <BackToolbarButton label={backToDirectoryLabel} onClick={onBackToDirectory} />
        ) : undefined}
      />

      <AirtableEmbeddedForm recordId={recordId} />
    </AppPageLayout>
  );
}
