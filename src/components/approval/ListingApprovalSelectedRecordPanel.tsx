import { Suspense, lazy } from 'react';
import { ApprovalFormFields } from '@/components/approval/ApprovalFormFields';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';
import { ListingApprovalSelectedRecordView } from '@/components/approval/ListingApprovalSelectedRecordView';
import type { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import type { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import type { AirtableRecord } from '@/types/airtable';

const ListingApprovalCombinedSections = lazy(async () => ({ default: (await import('@/components/approval/ListingApprovalCombinedSections')).ListingApprovalCombinedSections }));
const ListingApprovalRecordPayloadPanels = lazy(async () => ({ default: (await import('@/components/approval/ListingApprovalRecordPayloadPanels')).ListingApprovalRecordPayloadPanels }));

function ApprovalEditorFallback() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4 text-sm text-slate-300">
      <p className="m-0 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-400">Loading record editor</p>
      <div className="mt-4 space-y-3" aria-hidden="true">
        <div className="h-4 w-36 animate-pulse rounded-md bg-white/10" />
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-28 animate-pulse rounded-xl bg-white/5" />
          <div className="h-28 animate-pulse rounded-xl bg-white/5" />
        </div>
      </div>
    </section>
  );
}

export interface ListingApprovalSelectedRecordPanelProps {
  selectedRecord: AirtableRecord;
  titleFieldName: string;
  isApproved: boolean;
  saving: boolean;
  error: string | null;
  onBackToList: () => void;
  secondaryActionButtonClass: string;
  errorSurfaceClass: string;
  isCombinedApproval: boolean;
  selectedRecordViewProps: ReturnType<typeof buildListingApprovalSelectedRecordViewProps>;
  selectedRecordStatusProps: ReturnType<typeof buildListingApprovalSelectedRecordStatusProps>;
}

export function ListingApprovalSelectedRecordPanel({
  selectedRecord,
  titleFieldName,
  isApproved,
  saving,
  error,
  onBackToList,
  secondaryActionButtonClass,
  errorSurfaceClass,
  isCombinedApproval,
  selectedRecordViewProps,
  selectedRecordStatusProps,
}: ListingApprovalSelectedRecordPanelProps) {
  return (
    <ListingApprovalSelectedRecordView
      selectedRecord={selectedRecord}
      titleFieldName={titleFieldName}
      isApproved={isApproved}
      saving={saving}
      error={error}
      onBackToList={onBackToList}
      secondaryActionButtonClass={secondaryActionButtonClass}
      errorSurfaceClass={errorSurfaceClass}
      editor={(
        <Suspense fallback={<ApprovalEditorFallback />}>
          {isCombinedApproval ? (
            <ListingApprovalCombinedSections {...selectedRecordViewProps.combinedSectionsProps} />
          ) : (
            <ApprovalFormFields {...selectedRecordViewProps.approvalFormFieldsProps} />
          )}
        </Suspense>
      )}
      alerts={<ListingApprovalRecordAlerts {...selectedRecordStatusProps.alertsProps} />}
      actions={<ListingApprovalRecordActions {...selectedRecordStatusProps.actionsProps} />}
      payloadPanels={(
        <Suspense fallback={<ApprovalEditorFallback />}>
          <ListingApprovalRecordPayloadPanels {...selectedRecordViewProps.payloadPanelProps} />
        </Suspense>
      )}
    />
  );
}