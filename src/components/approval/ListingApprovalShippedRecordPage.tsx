import { useMemo } from 'react';
import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { BackToolbarButton } from '@/components/app/BackToolbarButton';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { LoadingSurface } from '@/components/app/StateSurfaces';
import { WorkflowRecordPageLayout } from '@/components/app/WorkflowRecordPageLayout';
import { ListingApprovalSoldReadyPanel } from '@/components/approval/ListingApprovalSoldReadyPanel';
import { useListingApprovalTabState } from '@/components/approval/useListingApprovalTabState';
import { checkOptionalEnv } from '@/config/runtimeEnv';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { useApprovalStore, displayValue } from '@/stores/approvalStore';

interface ListingApprovalShippedRecordPageProps {
  recordId: string;
  onBackToCompletedShipments: () => void;
  onOpenWorkflowSnapshot: (recordId: string) => void;
}

const COMBINED_LISTINGS_TABLE_NAME = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');
const COMBINED_LISTINGS_TABLE_REF = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');

export function ListingApprovalShippedRecordPage({
  recordId,
  onBackToCompletedShipments,
  onOpenWorkflowSnapshot,
}: ListingApprovalShippedRecordPageProps) {
  const viewModel: ApprovalTabViewModel = useMemo(() => ({
    selectedRecordId: recordId,
    onSelectRecord: () => {},
    onBackToList: onBackToCompletedShipments,
  }), [onBackToCompletedShipments, recordId]);
  const { loadRecords } = useApprovalStore();
  const {
    selectedRecord,
    queuePanelProps,
  } = useListingApprovalTabState({
    viewModel,
    tableReference: COMBINED_LISTINGS_TABLE_REF,
    tableName: COMBINED_LISTINGS_TABLE_NAME,
    approvalChannel: 'combined',
    backToListLabel: 'Back to Completed Shipments',
  });

  if (!selectedRecord) {
    if (queuePanelProps.loading) {
      return <LoadingSurface message="Loading completed shipment..." />;
    }

    return (
      <AppPageLayout>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Completed Shipment</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">Shipment record not found</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The requested shipment record is not available in the current dataset. If sample data was reseeded, the old record ID may no longer exist.
          </p>
          <div className="mt-5">
            <BackToolbarButton label="Back to Completed Shipments" onClick={onBackToCompletedShipments} />
          </div>
        </section>
      </AppPageLayout>
    );
  }

  const readiness = getUsedGearWorkflowListingReadiness(selectedRecord);
  const recordTitle = readiness.title
    || (readiness.titleFieldName ? displayValue(selectedRecord.fields[readiness.titleFieldName]) : '')
    || 'Completed Shipment';

  return (
    <WorkflowRecordPageLayout
      eyebrow="Selling"
      title={recordTitle}
      actions={(
        <>
          <BackToolbarButton label="Back to Completed Shipments" onClick={onBackToCompletedShipments} />
          <CompactIconActionButton
            label="Workflow Snapshot"
            icon="eye"
            variant="toolbar-secondary"
            onClick={() => onOpenWorkflowSnapshot(recordId)}
          />
        </>
      )}
    >
      <ListingApprovalSoldReadyPanel
        selectedRecord={selectedRecord}
        tableReference={COMBINED_LISTINGS_TABLE_REF}
        tableName={COMBINED_LISTINGS_TABLE_NAME}
        loadRecords={loadRecords}
      />
    </WorkflowRecordPageLayout>
  );
}
