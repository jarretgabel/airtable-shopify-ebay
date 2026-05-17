import { Suspense, lazy, type ReactNode } from 'react';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { ListingApprovalRecordActions } from '@/components/approval/ListingApprovalRecordActions';
import { ListingApprovalRecordAlerts } from '@/components/approval/ListingApprovalRecordAlerts';
import { ListingApprovalSelectedRecordView } from '@/components/approval/ListingApprovalSelectedRecordView';
import { ListingApprovalWorkflowSummary, type ListingApprovalWorkflowSummaryData } from '@/components/approval/ListingApprovalWorkflowSummary';
import type { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import type { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import type { AirtableRecord } from '@/types/airtable';

const ApprovalFormFields = lazy(async () => ({ default: (await import('@/components/approval/ApprovalFormFields')).ApprovalFormFields }));
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
  eyebrowLabel?: string;
  isApproved: boolean;
  saving: boolean;
  error: string | null;
  onBackToList: () => void;
  backToListLabel?: string;
  secondaryActionButtonClass: string;
  errorSurfaceClass: string;
  isCombinedApproval: boolean;
  workflowSummary: ListingApprovalWorkflowSummaryData | null;
  workflowDetails: ReactNode | null;
  selectedRecordViewProps: ReturnType<typeof buildListingApprovalSelectedRecordViewProps>;
  selectedRecordStatusProps: ReturnType<typeof buildListingApprovalSelectedRecordStatusProps>;
}

function getCombinedListingsSelectedRecordCopy(summary: ListingApprovalWorkflowSummaryData | null) {
  const workflowStatus = summary?.workflowStatus ?? '';
  const isPreListingReview = workflowStatus === 'Awaiting Pre-Listing Review';

  return {
    title: isPreListingReview ? 'Pre-Listing Review Workspace' : 'Combined Listings Record',
  };
}

export function ListingApprovalSelectedRecordPanel({
  selectedRecord,
  titleFieldName,
  eyebrowLabel,
  isApproved,
  saving,
  error,
  onBackToList,
  backToListLabel,
  secondaryActionButtonClass,
  errorSurfaceClass,
  isCombinedApproval,
  workflowSummary,
  workflowDetails,
  selectedRecordViewProps,
  selectedRecordStatusProps,
}: ListingApprovalSelectedRecordPanelProps) {
  const combinedCopy = getCombinedListingsSelectedRecordCopy(workflowSummary);

  const selectedRecordView = (
    <ListingApprovalSelectedRecordView
      selectedRecord={selectedRecord}
      titleFieldName={titleFieldName}
      eyebrowLabel={eyebrowLabel}
      isApproved={isApproved}
      saving={saving}
      error={error}
      onBackToList={onBackToList}
      backToListLabel={backToListLabel}
      secondaryActionButtonClass={secondaryActionButtonClass}
      errorSurfaceClass={errorSurfaceClass}
      workflowSummary={workflowSummary ? <ListingApprovalWorkflowSummary summary={workflowSummary} timelineOnly /> : null}
      workflowDetails={workflowDetails}
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
      payloadPanels={isCombinedApproval
        ? null
        : (
          <Suspense fallback={<ApprovalEditorFallback />}>
            <ListingApprovalRecordPayloadPanels {...selectedRecordViewProps.payloadPanelProps} />
          </Suspense>
        )}
    />
  );

  if (!isCombinedApproval) {
    return selectedRecordView;
  }

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow="Review"
        title={combinedCopy.title}
      />

      {selectedRecordView}
    </AppPageLayout>
  );
}