import { useState } from 'react';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';
import type { ManualIntakeFormLoadResult } from '@/services/manualIntakeForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
  onBackToDirectory?: () => void;
  backToDirectoryLabel?: string;
  eyebrow?: string;
  onCreateSuccess?: (createdRecordIds: string[]) => void;
}

export function UsedGearManualIntakePage({
  recordId,
  onBackToDirectory,
  backToDirectoryLabel = 'Back to Intake Directory',
  eyebrow = 'Intake',
  onCreateSuccess,
}: UsedGearManualIntakePageProps) {
  const [itemTitle, setItemTitle] = useState('');

  const handleLoadResult = (result: ManualIntakeFormLoadResult) => {
    setItemTitle(result.itemTitle);
  };

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow={eyebrow}
        title={recordId ? (itemTitle || 'Intake Record') : 'Create Intake Item'}
        actions={recordId && onBackToDirectory ? (
          <BackToolbarButton label={backToDirectoryLabel} onClick={onBackToDirectory} />
        ) : undefined}
      />

      <AirtableEmbeddedForm
        recordId={recordId}
        onLoadResult={handleLoadResult}
        onCreateSuccess={onCreateSuccess}
      />
    </AppPageLayout>
  );
}
