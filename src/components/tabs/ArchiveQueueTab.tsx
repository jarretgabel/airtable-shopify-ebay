import { WorkflowQueuePageTemplate } from '@/components/app/WorkflowQueuePageTemplate';
import {
  ARCHIVE_OVERVIEW_SECTION_ID,
  ARCHIVE_SECTION_DEFINITIONS,
  UsedGearWorkflowPostPublishSection,
} from '@/components/tabs/airtable/UsedGearWorkflowPostPublishSection';

interface ArchiveQueueTabProps {
  currentUserName: string;
  onOpenWorkflowSnapshot: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  onOpenSoldReadyRecord: (recordId: string) => void;
  onOpenShipmentRecord: (recordId: string) => void;
}

export function ArchiveQueueTab({
  currentUserName,
  onOpenWorkflowSnapshot,
  onOpenListingsRecord,
  onOpenSoldReadyRecord,
  onOpenShipmentRecord,
}: ArchiveQueueTabProps) {
  return (
    <WorkflowQueuePageTemplate eyebrow="Selling" title="Completed Shipments">
      <UsedGearWorkflowPostPublishSection
        currentUserName={currentUserName}
        showSectionIntro={false}
        showSectionTitles={false}
        sectionDefinitions={ARCHIVE_SECTION_DEFINITIONS}
        overviewSectionId={ARCHIVE_OVERVIEW_SECTION_ID}
        queueTitle="Completed Shipments"
        queueNoun="completed shipments"
        focusedBucketNotice=""
        emptyStateTitle="No archived workflow rows"
        emptyStateMessage="The used-gear workflow currently has no shipped rows in archive."
        nextRouteMessage="Next route: complete shipment handoff from Post-Publish, then use Archive for completed-item lookup."
        searchPlaceholder="Search by status, SKU, model, or ship date"
        onOpenOperationalRecord={onOpenWorkflowSnapshot}
        onOpenListingsRecord={onOpenListingsRecord}
        onOpenSoldReadyRecord={onOpenSoldReadyRecord}
        onOpenShipmentRecord={onOpenShipmentRecord}
      />
    </WorkflowQueuePageTemplate>
  );
}