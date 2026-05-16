/* eslint-disable react-refresh/only-export-components */

import {
  buildUsedGearConcurrentStageSignoffs,
  deriveUsedGearNextTeams,
  getUsedGearWorkflowStatus,
} from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { buildUsedGearWorkflowTimeline, type UsedGearWorkflowTimelineEntry } from '@/services/usedGearWorkflowTimeline';
import type { AirtableRecord } from '@/types/airtable';

export interface ListingApprovalWorkflowSummaryData {
  workflowStatus: string;
  workflowNextTeam: string;
  timeline: UsedGearWorkflowTimelineEntry[];
  resolvedPrice: string;
  preListingReviewedBy: string;
}

interface ListingApprovalWorkflowSummaryProps {
  summary: ListingApprovalWorkflowSummaryData;
  timelineOnly?: boolean;
}

export interface ListingApprovalWorkflowProcessCardProps {
  summary: ListingApprovalWorkflowSummaryData | null;
  timelineOnly?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: (() => void) | null;
  secondaryActionLabel?: string;
  onSecondaryAction?: (() => void) | null;
}

interface WorkflowStatusPresentation {
  badgeClassName: string;
  progressClassName: string;
  statusLabel: string;
  statusDescription: string;
  nextTeamLabel: string;
  marketplaceLabels: string[];
}

function formatTimelineTimestamp(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPreferredTimelineEntryId(workflowStatus: string): UsedGearWorkflowTimelineEntry['id'] | null {
  switch (workflowStatus) {
    case 'Accepted - Awaiting Arrival':
      return 'accepted';
    case 'Accepted - Arrived, Awaiting SKU':
    case 'Accepted - Arrived, Awaiting Missing Item':
      return 'processing';
    case 'Awaiting Pre-Listing Review':
      return 'awaiting-pre-listing';
    case 'Approved for Publish':
      return 'approved';
    case 'Listed, Shopify':
    case 'Listed, eBay':
      return 'listed';
    case 'Stale Listing, Shopify':
    case 'Stale Listing, eBay':
      return 'stale-listing';
    case 'Sold - Ready to Ship':
      return 'sold-ready';
    case 'Shipped':
      return 'shipped';
    default:
      return null;
  }
}

function getActiveTimelineIndex(timeline: UsedGearWorkflowTimelineEntry[], workflowStatus: string): number {
  if (workflowStatus === 'Testing and Photography In Progress') {
    const testingOrPhotographyIndex = timeline.findIndex((entry) =>
      (entry.id === 'testing' || entry.id === 'photography') && entry.status === 'pending',
    );
    if (testingOrPhotographyIndex >= 0) {
      return testingOrPhotographyIndex;
    }
  }

  const preferredEntryId = getPreferredTimelineEntryId(workflowStatus);
  if (preferredEntryId) {
    const preferredIndex = timeline.findIndex((entry) => entry.id === preferredEntryId);
    if (preferredIndex >= 0) {
      return preferredIndex;
    }
  }

  const firstPendingIndex = timeline.findIndex((entry) => entry.status === 'pending');
  if (firstPendingIndex >= 0) {
    return firstPendingIndex;
  }

  return Math.max(timeline.length - 1, 0);
}

function getStatusBadgeClassName(status: string): string {
  if (status === 'Shipped') {
    return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  }

  if (status === 'Sold - Ready to Ship' || status === 'Approved for Publish') {
    return 'border-sky-400/35 bg-sky-500/15 text-sky-100';
  }

  if (status.includes('Listed')) {
    return 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100';
  }

  if (status.includes('Stale')) {
    return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
  }

  if (status === 'Unqualified') {
    return 'border-rose-400/35 bg-rose-500/15 text-rose-100';
  }

  return 'border-slate-300/15 bg-white/5 text-slate-100';
}

function getMarketplaceChipClassName(label: string): string {
  if (label === 'Shopify') {
    return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  }

  if (label === 'eBay') {
    return 'border-blue-400/35 bg-blue-500/15 text-blue-100';
  }

  return 'border-[var(--line)] bg-white/5 text-[var(--muted)]';
}

function getWorkflowStatusPresentation(status: string): WorkflowStatusPresentation {
  switch (status) {
    case 'Pending Review':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-200',
        statusLabel: 'Awaiting intake decision',
        statusDescription: 'Purchasing still needs to qualify the intake and decide whether this item enters the workflow.',
        nextTeamLabel: 'Purchasing review pending',
        marketplaceLabels: [],
      };
    case 'Unqualified':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-rose-500 via-rose-400 to-orange-300',
        statusLabel: 'Stopped before listing',
        statusDescription: 'The intake was rejected or removed from the sellable workflow, so no listing work should continue.',
        nextTeamLabel: 'No downstream work',
        marketplaceLabels: [],
      };
    case 'Accepted - Awaiting Arrival':
      return {
        badgeClassName: 'border-amber-400/35 bg-amber-500/15 text-amber-100',
        progressClassName: 'bg-gradient-to-r from-amber-500 via-orange-400 to-amber-300',
        statusLabel: 'Accepted, waiting for arrival',
        statusDescription: 'The item is approved for intake but processing cannot advance until the physical item arrives.',
        nextTeamLabel: 'Processing after arrival',
        marketplaceLabels: [],
      };
    case 'Accepted - Arrived, Awaiting SKU':
      return {
        badgeClassName: 'border-amber-400/35 bg-amber-500/15 text-amber-100',
        progressClassName: 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300',
        statusLabel: 'Arrival complete, SKU still missing',
        statusDescription: 'Processing has the item in hand, but cataloging is blocked until the SKU and inventory identity are assigned.',
        nextTeamLabel: 'Assign SKU in processing',
        marketplaceLabels: [],
      };
    case 'Accepted - Arrived, Awaiting Missing Item':
      return {
        badgeClassName: 'border-amber-400/35 bg-amber-500/15 text-amber-100',
        progressClassName: 'bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300',
        statusLabel: 'Arrival blocked by missing item follow-up',
        statusDescription: 'The intake was accepted, but a missing-item issue needs resolution before testing and listing can proceed.',
        nextTeamLabel: 'Resolve missing item',
        marketplaceLabels: [],
      };
    case 'Testing and Photography In Progress':
      return {
        badgeClassName: 'border-sky-400/35 bg-sky-500/15 text-sky-100',
        progressClassName: 'bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300',
        statusLabel: 'Technical review in flight',
        statusDescription: 'Testing and photography are the active checkpoints. Listing prep should wait until both signoffs are complete.',
        nextTeamLabel: 'Finish testing and photos',
        marketplaceLabels: [],
      };
    case 'Awaiting Pre-Listing Review':
      return {
        badgeClassName: 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100',
        progressClassName: 'bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-300',
        statusLabel: 'Ready for listing QA',
        statusDescription: 'Operational signoffs are complete. Listing content, pricing, and marketplace readiness need final review.',
        nextTeamLabel: 'Listing QA required',
        marketplaceLabels: [],
      };
    case 'Approved for Publish':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-300',
        statusLabel: 'Publish-ready',
        statusDescription: 'The item passed pre-listing review and is ready to be pushed live to Shopify, eBay, or both.',
        nextTeamLabel: 'Publish listing',
        marketplaceLabels: ['Shopify', 'eBay'],
      };
    case 'Listed, Shopify':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-300',
        statusLabel: 'Live on Shopify',
        statusDescription: 'The listing is published on Shopify. Monitor for sell-through or stale-listing recovery work.',
        nextTeamLabel: 'Monitor live listing',
        marketplaceLabels: ['Shopify'],
      };
    case 'Listed, eBay':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-300',
        statusLabel: 'Live on eBay',
        statusDescription: 'The listing is published on eBay. Monitor for sell-through or stale-listing recovery work.',
        nextTeamLabel: 'Monitor live listing',
        marketplaceLabels: ['eBay'],
      };
    case 'Stale Listing, Shopify':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-amber-500 via-orange-400 to-rose-300',
        statusLabel: 'Shopify listing needs recovery',
        statusDescription: 'The listing was live but is now stale. Listing ops needs to investigate and relist or clean up the record.',
        nextTeamLabel: 'Relist or resolve stale state',
        marketplaceLabels: ['Shopify'],
      };
    case 'Stale Listing, eBay':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-amber-500 via-orange-400 to-rose-300',
        statusLabel: 'eBay listing needs recovery',
        statusDescription: 'The listing was live but is now stale. Listing ops needs to investigate and relist or clean up the record.',
        nextTeamLabel: 'Relist or resolve stale state',
        marketplaceLabels: ['eBay'],
      };
    case 'Sold - Ready to Ship':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-emerald-500 via-lime-400 to-sky-300',
        statusLabel: 'Sold, handoff to shipping',
        statusDescription: 'The item sold successfully and is waiting for shipping completion and final fulfillment confirmation.',
        nextTeamLabel: 'Ship sold item',
        marketplaceLabels: [],
      };
    case 'Shipped':
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300',
        statusLabel: 'Workflow complete',
        statusDescription: 'The listing completed the full intake-to-ship path. Remaining work is archival or reporting only.',
        nextTeamLabel: 'No open handoff',
        marketplaceLabels: [],
      };
    default:
      return {
        badgeClassName: getStatusBadgeClassName(status),
        progressClassName: 'bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300',
        statusLabel: 'Workflow in progress',
        statusDescription: 'The record is active in the used-gear process and still has downstream work before fulfillment is complete.',
        nextTeamLabel: 'Next handoff pending',
        marketplaceLabels: [],
      };
  }
}

function getTimelineCardClassName(
  entry: UsedGearWorkflowTimelineEntry,
  index: number,
  activeIndex: number,
): string {
  if (entry.status === 'completed' || index < activeIndex) {
    return 'border-emerald-400/30 bg-emerald-500/10';
  }

  if (index === activeIndex) {
    return 'border-amber-400/35 bg-amber-500/10';
  }

  return 'border-[var(--line)] bg-[var(--bg)]';
}

function getTimelineDotClassName(
  entry: UsedGearWorkflowTimelineEntry,
  index: number,
  activeIndex: number,
): string {
  if (entry.status === 'completed' || index < activeIndex) {
    return 'border-emerald-300/70 bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]';
  }

  if (index === activeIndex) {
    return 'border-amber-300/80 bg-amber-300 shadow-[0_0_0_6px_rgba(245,158,11,0.14)]';
  }

  return 'border-[var(--line)] bg-[var(--bg)]';
}

function getTimelineStatusBadgeClassName(isCompleted: boolean, isActive: boolean): string {
  if (isCompleted) {
    return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100';
  }

  if (isActive) {
    return 'border-amber-400/35 bg-amber-500/15 text-amber-100';
  }

  return 'border-[var(--line)] bg-white/5 text-[var(--muted)]';
}

function getTimelineCompletionGuidance(entryId: UsedGearWorkflowTimelineEntry['id']): string {
  switch (entryId) {
    case 'accepted':
      return 'Use "Open Incoming Gear" to update the intake record, then click "Complete Processing" when the item is ready to move forward.';
    case 'owner-assigned':
      return 'Ownership history is retained for older rows, but active handoffs now move forward through the stage completion actions instead of claim controls.';
    case 'processing':
      return 'Finish the intake details in "Open Incoming Gear", then click "Complete Processing" to send the item to testing and photography.';
    case 'testing':
      return 'Use "Open Testing" to capture the testing signoff for this item.';
    case 'photography':
      return 'Use "Open Photos" to capture the photography signoff for this item.';
    case 'awaiting-pre-listing':
      return 'Use "Open Listings Approval" to review the listing once both testing and photography are signed off.';
    case 'pre-listing':
      return 'Review the listing in "Open Listings Approval", then click "Approve For Publish" when pricing and content are ready.';
    case 'approved':
      return 'Use "Open Listings Approval" to publish the listing to Shopify or eBay.';
    case 'listed':
      return 'Use "Open Listings Approval" to verify the live listing and manage any follow-up listing changes.';
    case 'stale-listing':
      return 'Use "Open Listings Approval" to review the stale listing, then click "Mark Relisted" when it is live again.';
    case 'relisted':
      return 'Confirm the relisted item is live and continue managing it from "Open Listings Approval".';
    case 'sold-ready':
      return 'Hand the item off for fulfillment, then click "Mark Shipped" when shipping is complete.';
    case 'shipped':
      return 'No further action is needed. This workflow is complete.';
    default:
      return 'Complete the required workflow action for this milestone to move the listing forward.';
  }
}

export function buildListingApprovalWorkflowSummaryData(record: AirtableRecord): ListingApprovalWorkflowSummaryData | null {
  const workflowStatus = getUsedGearWorkflowStatus(record.fields);
  if (!workflowStatus) {
    return null;
  }

  const readiness = getUsedGearWorkflowListingReadiness(record);
  const nextTeams = deriveUsedGearNextTeams(workflowStatus, buildUsedGearConcurrentStageSignoffs(record.fields));

  return {
    workflowStatus,
    workflowNextTeam: nextTeams.join(', '),
    timeline: buildUsedGearWorkflowTimeline(record),
    resolvedPrice: readiness.price,
    preListingReviewedBy: typeof record.fields['Pre-Listing Reviewed By'] === 'string'
      ? record.fields['Pre-Listing Reviewed By'].trim()
      : '',
  };
}

export function ListingApprovalWorkflowProcessCard({
  summary,
  timelineOnly = false,
  eyebrow = 'Workflow Review Context',
  title = 'Used-Gear Intake And Listing Process',
  description = 'Workflow status, ownership, and milestone progress for this listing from intake through shipment.',
  loading = false,
  error = null,
  emptyMessage = 'No used-gear operational row is linked to this listing yet.',
  primaryActionLabel,
  onPrimaryAction = null,
  secondaryActionLabel,
  onSecondaryAction = null,
}: ListingApprovalWorkflowProcessCardProps) {
  if (loading) {
    return (
      <section className="mb-4 rounded-2xl border border-[var(--line)] bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
            <div className="h-6 w-72 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-7 w-36 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
            <div className="mt-4 h-2 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
              <div className="h-20 animate-pulse rounded-xl bg-white/5" />
            </div>
          </div>
          <div className="h-52 animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--bg)]" />
        </div>
        <div className="mt-4 flex w-full items-center gap-2">
          <div className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] animate-pulse" />
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="h-6 flex-1 rounded-full border border-[var(--line)] bg-[var(--bg)] animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="mb-4 rounded-2xl border border-[var(--line)] bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p>
            <h4 className="m-0 mt-2 text-base font-semibold text-[var(--ink)]">{title}</h4>
            <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
        </div>
        <div className={[
          'mt-4 rounded-xl border px-4 py-3 text-sm leading-6',
          error ? 'border-amber-400/35 bg-amber-500/10 text-amber-50' : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]',
        ].join(' ')}>
          {error || emptyMessage}
        </div>
      </section>
    );
  }

  const completedCount = summary.timeline.filter((entry) => entry.status === 'completed').length;
  const activeIndex = getActiveTimelineIndex(summary.timeline, summary.workflowStatus);
  const activeEntry = summary.timeline[activeIndex] ?? null;
  const statusPresentation = getWorkflowStatusPresentation(summary.workflowStatus);

  const milestonesContent = (
    <div className={timelineOnly ? '' : 'mt-4'}>
      {!timelineOnly ? (
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Milestones</p>
      ) : null}
      <div className={timelineOnly ? '' : 'mt-3'}>
        <div className="flex w-full items-center">
          <div
            className="relative grid min-w-0 flex-1 items-center"
            style={{
              gridTemplateColumns: summary.timeline
                .map((_, index) => (index === activeIndex ? 'auto' : 'minmax(0, 1fr)'))
                .join(' '),
            }}
          >
            {summary.timeline.map((entry, index) => {
              const isCompleted = entry.status === 'completed' || index < activeIndex;
              const isActive = index === activeIndex;
              const isInferredCompleted = isCompleted && entry.status !== 'completed';
              const completionGuidance = getTimelineCompletionGuidance(entry.id);
              const isImmediatelyBeforeActive = index === activeIndex - 1;
              const isImmediatelyAfterActive = index === activeIndex + 1;
              const showLeftConnector = index > 0 && !isActive;
              const showRightConnector = index < summary.timeline.length - 1 && !isActive;
              const updatedLabel = isInferredCompleted
                ? 'Completed via current workflow status'
                : formatTimelineTimestamp(entry.timestamp);
              const detailSummary = [
                `${isCompleted ? 'Completed' : isActive ? 'Current' : 'Pending'} milestone`,
                updatedLabel,
                entry.actor ? `By ${entry.actor}` : null,
              ].filter(Boolean).join(' • ');

              return (
                <div
                  key={entry.id}
                  className={[
                    'relative z-10 flex justify-center',
                    isActive ? '' : 'min-w-0',
                  ].join(' ')}
                >
                  {showLeftConnector ? (
                    <span
                      aria-hidden="true"
                      className={[
                        'pointer-events-none absolute left-0 top-1/2 hidden h-0.5 -translate-y-1/2 rounded-full bg-[var(--line)]/70 md:block',
                        isImmediatelyAfterActive ? 'w-[calc(50%-0.625rem)]' : 'w-1/2',
                      ].join(' ')}
                    />
                  ) : null}
                  {showRightConnector ? (
                    <span
                      aria-hidden="true"
                      className={[
                        'pointer-events-none absolute right-0 top-1/2 hidden h-0.5 -translate-y-1/2 rounded-full bg-[var(--line)]/70 md:block',
                        isImmediatelyBeforeActive ? 'w-[calc(50%-0.625rem)]' : 'w-1/2',
                      ].join(' ')}
                    />
                  ) : null}

                  {isActive ? (
                    <div
                      tabIndex={0}
                      title={detailSummary}
                      aria-label={`Milestone ${entry.label}`}
                      className={[
                        'group relative inline-flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2 outline-none transition-colors',
                        'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-blue-400/30',
                        getTimelineCardClassName(entry, index, activeIndex),
                      ].join(' ')}
                    >
                      {index > 0 ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute right-full top-1/2 hidden h-0.5 w-4 -translate-y-1/2 md:block"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--line) 70%, transparent)' }}
                        />
                      ) : null}
                      {index < summary.timeline.length - 1 ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute left-full top-1/2 hidden h-0.5 w-4 -translate-y-1/2 md:block"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--line) 70%, transparent)' }}
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className={[
                          'inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors',
                          getTimelineDotClassName(entry, index, activeIndex),
                        ].join(' ')}
                      />
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-[var(--ink)]">{entry.label}</p>
                      </div>

                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-72 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--panel)]/95 px-3 py-3 opacity-0 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur transition md:block group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                        <div>
                          <p className="m-0 mt-1 text-sm font-semibold text-[var(--ink)]">{entry.label}</p>
                        </div>
                        <p className="m-0 mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Updated</p>
                        <p className="m-0 mt-1 text-sm text-[var(--ink)]">{updatedLabel}</p>
                        {entry.actor ? (
                          <p className="m-0 mt-2 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">By {entry.actor}</p>
                        ) : null}
                        <p className="m-0 mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">How To Complete</p>
                        <p className="m-0 mt-1 text-sm leading-6 text-[var(--ink)]">{completionGuidance}</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      tabIndex={0}
                      title={detailSummary}
                      aria-label={`Milestone ${entry.label}`}
                      className={[
                        'group relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border outline-none transition-colors',
                        'focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-blue-400/30',
                        getTimelineCardClassName(entry, index, activeIndex),
                      ].join(' ')}
                    >
                      <span
                        aria-hidden="true"
                        className={[
                          'inline-flex h-3 w-3 rounded-full border-2 transition-colors',
                          getTimelineDotClassName(entry, index, activeIndex),
                        ].join(' ')}
                      />
                      <span className="sr-only">{entry.label} {isCompleted ? 'Completed' : 'Pending'}</span>

                      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--panel)]/95 px-3 py-3 opacity-0 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur transition md:block group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="m-0 mt-1 text-sm font-semibold text-[var(--ink)]">{entry.label}</p>
                          </div>
                          <span className={[
                            'shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em]',
                            getTimelineStatusBadgeClassName(isCompleted, false),
                          ].join(' ')}>
                            {isCompleted ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                        <p className="m-0 mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Updated</p>
                        <p className="m-0 mt-1 text-sm text-[var(--ink)]">{updatedLabel}</p>
                        {entry.actor ? (
                          <p className="m-0 mt-2 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">By {entry.actor}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {activeEntry ? (
          <p className="m-0 mt-2 text-xs text-[var(--muted)] md:hidden">
            Current stage: <span className="font-semibold text-[var(--ink)]">{activeEntry.label}</span>
          </p>
        ) : null}
      </div>
    </div>
  );

  if (timelineOnly) {
    return (
      <section className="mb-4 rounded-2xl border border-[var(--line)] bg-white/5 p-4">
        <div>
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Workflow Timeline</p>
          <p className="m-0 mt-2 text-sm leading-6 text-[var(--muted)]">
            Milestone progress for the linked used-gear workflow, from intake through final fulfillment.
          </p>
        </div>
        {milestonesContent}
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-[var(--line)] bg-white/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{eyebrow}</p>
          <h4 className="m-0 mt-2 text-base font-semibold text-[var(--ink)]">{title}</h4>
          <p className="m-0 mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
        <span className={[
          'inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em]',
          statusPresentation.badgeClassName,
        ].join(' ')}>
          {summary.workflowStatus}
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
          <div>
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Process Overview</p>
            <h5 className="m-0 mt-2 text-sm font-semibold text-[var(--ink)]">{statusPresentation.statusLabel}</h5>
            <p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{statusPresentation.statusDescription}</p>
          </div>
          {statusPresentation.marketplaceLabels.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {statusPresentation.marketplaceLabels.map((label) => (
                <span
                  key={label}
                  className={[
                    'rounded-full border px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.08em]',
                    getMarketplaceChipClassName(label),
                  ].join(' ')}
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">{completedCount}/{summary.timeline.length}</span> milestones
            </div>
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)]">
              <span className="text-[var(--muted)]">Next:</span>{' '}
              <span className="font-semibold text-[var(--ink)]">{summary.workflowNextTeam || 'No open handoff'}</span>
            </div>
            <div className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)]">
              <span className="text-[var(--muted)]">Price:</span>{' '}
              <span className="font-semibold text-[var(--ink)]">{summary.resolvedPrice || 'Missing price'}</span>
            </div>
            {summary.preListingReviewedBy ? (
              <div className="rounded-full border border-[var(--line)] bg-white/5 px-3 py-1.5 text-sm text-[var(--muted)]">
                <span className="text-[var(--muted)]">Reviewer:</span>{' '}
                <span className="font-semibold text-[var(--ink)]">{summary.preListingReviewedBy}</span>
              </div>
            ) : null}
          </div>
          {primaryActionLabel && onPrimaryAction ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/45 hover:bg-sky-500/20"
                onClick={onPrimaryAction}
              >
                {primaryActionLabel}
              </button>
              {secondaryActionLabel && onSecondaryAction ? (
                <button
                  type="button"
                  className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={onSecondaryAction}
                >
                  {secondaryActionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Listing Readiness</p>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
            <div className="text-[var(--muted)]">Resolved price</div>
            <div className="mt-1 font-semibold text-[var(--ink)]">{summary.resolvedPrice || 'Missing price'}</div>
          </div>
        </div>
      </div>

      {milestonesContent}
    </section>
  );
}

export function ListingApprovalWorkflowSummary({ summary, timelineOnly = false }: ListingApprovalWorkflowSummaryProps) {
  return <ListingApprovalWorkflowProcessCard summary={summary} timelineOnly={timelineOnly} />;
}