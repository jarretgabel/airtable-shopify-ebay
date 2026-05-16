import { Suspense, lazy, type ReactNode } from 'react';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
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
    description: isPreListingReview
      ? 'This record is in the first listing-phase state. Finalize pricing, listing content, and marketplace readiness here, then approve it for publish from this page.'
      : 'Use this record page for listing-phase corrections, publish preparation, and later listing lifecycle work without leaving the combined Listings surface.',
    phaseSummary: isPreListingReview
      ? 'The selected record is now the operational home for the former pre-listing review step. Resolve blockers, confirm reviewer intent, and keep approval on the listing page.'
      : 'This record remains on the listing-phase surface for publish execution or later lifecycle work. Keep upstream fixes on their source pages, then return here for the final listing action.',
    actionSummary: isPreListingReview
      ? 'Save any edits first. Once Shopify and eBay requirements are satisfied, use Approve for Publish here instead of routing to a separate queue.'
      : 'Use this page to review current workflow status, publish state, and any post-publish lifecycle notes tied to the same operational row.',
    operatorGuide: isPreListingReview
      ? 'Work the selected listing record like the former review queue: confirm the data, use the inline blocker messaging to find any missing source information, save updates, and approve for publish only after the combined record is ready.'
      : 'Keep the selected listing record as the home for listing-phase changes. Open operational, testing, or photos source records only when a blocker still belongs upstream, then return here to finish the listing action.',
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <WorkflowPageHeader
        eyebrow="Used Gear Workflow"
        title={combinedCopy.title}
        description={combinedCopy.description}
        detail={workflowSummary ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Workflow status: {workflowSummary.workflowStatus}
            </span>
            <span className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              Next team: {workflowSummary.workflowNextTeam}
            </span>
          </div>
        ) : null}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Review Home</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <p className="m-0">{combinedCopy.phaseSummary}</p>
            <p className="m-0">{combinedCopy.actionSummary}</p>
            <p className="m-0">Grouped context, workflow summary, blocker messaging, approval actions, and later listing lifecycle notes all stay on this selected record so operators do not have to bounce between multiple review surfaces.</p>
          </div>
        </div>

        <aside className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Review Flow</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">1. Confirm Listing Data</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Use the shared listing editors below to fix title, description, key features, pricing, and marketplace-specific fields.</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">2. Resolve Upstream Blockers</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">If readiness checks fail, use the linked operational or testing surfaces for the source correction, then come back here to finish review.</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3">
              <p className="m-0 text-sm font-semibold text-[var(--ink)]">3. Approve Or Publish</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Approve for publish when the row is still in pre-listing review. Use the publish controls here once the row has moved into Approved for Publish.</p>
            </div>
          </div>
        </aside>
      </section>

      <div className="max-w-3xl">
        <CollapsibleHelperText label="Listing review guide">
          {combinedCopy.operatorGuide}
        </CollapsibleHelperText>
      </div>

      {selectedRecordView}
    </div>
  );
}