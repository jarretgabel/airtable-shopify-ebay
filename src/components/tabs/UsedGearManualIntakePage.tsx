import { AppPageLayout } from '@/components/app/AppPageLayout';
import { PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
}

export function UsedGearManualIntakePage({ recordId }: UsedGearManualIntakePageProps) {
  return (
    <PanelSurface>
      <AppPageLayout>
        <WorkflowPageHeader
          eyebrow="Intake Forms"
          title="Manual Intake"
        />

        <AirtableEmbeddedForm recordId={recordId} />
      </AppPageLayout>
    </PanelSurface>
  );
}
