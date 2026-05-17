import { PanelSurface } from '@/components/app/StateSurfaces';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { AirtableEmbeddedForm } from '@/components/tabs/AirtableEmbeddedForm';

interface UsedGearManualIntakePageProps {
  recordId?: string | null;
}

export function UsedGearManualIntakePage({ recordId }: UsedGearManualIntakePageProps) {
  return (
    <PanelSurface>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <WorkflowPageHeader
          eyebrow="Inventory Processing"
          title="Manual Intake"
        />

        <AirtableEmbeddedForm recordId={recordId} />
      </div>
    </PanelSurface>
  );
}
