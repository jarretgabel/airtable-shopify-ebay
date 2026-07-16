import { useMemo } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { LoadingSurface } from '@/components/app/StateSurfaces';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ListingApprovalSoldReadyPanel } from '@/components/approval/ListingApprovalSoldReadyPanel';
import { ListingApprovalWorkflowOpsPanel } from '@/components/approval/ListingApprovalWorkflowOpsPanel';
import { useListingApprovalTabState } from '@/components/approval/useListingApprovalTabState';
import { checkOptionalEnv } from '@/config/runtimeEnv';
import { getUsedGearWorkflowPostPublishSnapshot } from '@/services/usedGearWorkflowLifecycle';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { useApprovalStore, displayValue } from '@/stores/approvalStore';

interface ListingApprovalSoldReadyRecordPageProps {
  recordId: string;
  onBackToPostPublish: () => void;
  onOpenWorkflowSnapshot: (recordId: string) => void;
  onOpenListingEditor: (recordId: string) => void;
}

const COMBINED_LISTINGS_TABLE_NAME = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');
const COMBINED_LISTINGS_TABLE_REF = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');

export function ListingApprovalSoldReadyRecordPage({
  recordId,
  onBackToPostPublish,
  onOpenWorkflowSnapshot,
  onOpenListingEditor,
}: ListingApprovalSoldReadyRecordPageProps) {
  const viewModel: ApprovalTabViewModel = useMemo(() => ({
    selectedRecordId: recordId,
    onSelectRecord: () => {},
    onBackToList: onBackToPostPublish,
  }), [onBackToPostPublish, recordId]);
  const { loadRecords } = useApprovalStore();
  const {
    selectedRecord,
    queuePanelProps,
  } = useListingApprovalTabState({
    viewModel,
    tableReference: COMBINED_LISTINGS_TABLE_REF,
    tableName: COMBINED_LISTINGS_TABLE_NAME,
    approvalChannel: 'combined',
    backToListLabel: 'Back to Post-Publish',
  });

  if (!selectedRecord) {
    if (queuePanelProps.loading) {
      return <LoadingSurface message="Loading sold-ready view..." />;
    }

    return (
      <AppPageLayout>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Sold-Ready Listing</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">Listing record not found</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The requested listing record is not available in the current dataset. If sample data was reseeded, the old record ID may no longer exist.
          </p>
          <div className="mt-5">
            <BackToolbarButton label="Back to Post-Publish" onClick={onBackToPostPublish} />
          </div>
        </section>
      </AppPageLayout>
    );
  }

  const readiness = getUsedGearWorkflowListingReadiness(selectedRecord);
  const recordTitle = readiness.title
    || (readiness.titleFieldName ? displayValue(selectedRecord.fields[readiness.titleFieldName]) : '')
    || 'Sold-Ready Listing';
  const snapshot = getUsedGearWorkflowPostPublishSnapshot(selectedRecord);
  const renderSoldReadyPanel = snapshot?.bucket === 'sold-ready' || snapshot?.bucket === 'shipped';

  return (
    <WorkflowRecordPageLayout
      eyebrow="Listings"
      title={recordTitle}
      actions={(
        <>
          <BackToolbarButton label="Back to Post-Publish" onClick={onBackToPostPublish} />
          <CompactIconActionButton
            label="Workflow Snapshot"
            icon="eye"
            variant="toolbar-secondary"
            onClick={() => onOpenWorkflowSnapshot(recordId)}
          />
          <CompactIconActionButton
            label="Open Listing Editor"
            icon="edit"
            variant="toolbar-secondary"
            onClick={() => onOpenListingEditor(recordId)}
          />
        </>
      )}
    >
      {renderSoldReadyPanel ? (
        <ListingApprovalSoldReadyPanel
          selectedRecord={selectedRecord}
          tableReference={COMBINED_LISTINGS_TABLE_REF}
          tableName={COMBINED_LISTINGS_TABLE_NAME}
          loadRecords={loadRecords}
        />
      ) : (
        <ListingApprovalWorkflowOpsPanel
          selectedRecord={selectedRecord}
          tableReference={COMBINED_LISTINGS_TABLE_REF}
          tableName={COMBINED_LISTINGS_TABLE_NAME}
          loadRecords={loadRecords}
        />
      )}
    </WorkflowRecordPageLayout>
  );
}
