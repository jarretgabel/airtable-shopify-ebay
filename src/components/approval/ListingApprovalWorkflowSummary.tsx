/* eslint-disable react-refresh/only-export-components */

import {
  buildUsedGearConcurrentStageSignoffs,
  deriveUsedGearIntakeDecision,
  deriveUsedGearNextTeams,
  getUsedGearWorkflowStatus,
} from '@/services/usedGearWorkflow';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import { buildUsedGearWorkflowTimeline, type UsedGearWorkflowTimelineEntry } from '@/services/usedGearWorkflowTimeline';
import type { AirtableRecord } from '@/types/airtable';

export interface ListingApprovalWorkflowSummaryData {
  workflowStatus: string;
  workflowIntakeDecision: string;
  workflowNextTeam: string;
  timeline: UsedGearWorkflowTimelineEntry[];
  resolvedTitle: string;
  resolvedDescription: string;
  resolvedPrice: string;
  priceSourceFieldName: string | null;
  preListingReviewedBy: string;
}

interface ListingApprovalWorkflowSummaryProps {
  summary: ListingApprovalWorkflowSummaryData;
}

export interface ListingApprovalWorkflowProcessCardProps {
  summary: ListingApprovalWorkflowSummaryData | null;
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

function getActiveTimelineIndex(timeline: UsedGearWorkflowTimelineEntry[]): number {
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
  if (entry.status === 'completed') {
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
  if (entry.status === 'completed') {
    return 'border-emerald-300/70 bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]';
  }

  if (index === activeIndex) {
    return 'border-amber-300/80 bg-amber-300 shadow-[0_0_0_6px_rgba(245,158,11,0.14)]';
  }

  return 'border-[var(--line)] bg-[var(--bg)]';
}

function getTimelineConnectorClassName(
  entry: UsedGearWorkflowTimelineEntry,
  index: number,
  activeIndex: number,
): string {
  if (entry.status === 'completed') {
    return 'bg-emerald-400/45';
  }

  if (index === activeIndex) {
    return 'bg-gradient-to-b from-amber-300/70 to-[var(--line)]';
  }

  return 'bg-[var(--line)]';
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
    workflowIntakeDecision: deriveUsedGearIntakeDecision(workflowStatus),
    workflowNextTeam: nextTeams.join(', '),
    timeline: buildUsedGearWorkflowTimeline(record),
    resolvedTitle: readiness.title,
    resolvedDescription: readiness.description,
    resolvedPrice: readiness.price,
    priceSourceFieldName: readiness.priceFieldName,
    preListingReviewedBy: typeof record.fields['Pre-Listing Reviewed By'] === 'string'
      ? record.fields['Pre-Listing Reviewed By'].trim()
      : '',
  };
}

export function ListingApprovalWorkflowProcessCard({
  summary,
  eyebrow = 'Workflow Review Context',
  title = 'Used-Gear Intake And Listing Process',
  description = 'Workflow status, ownership, and milestone progress for this listing from intake through shipment.',
  loading = false,
  error = null,
  emptyMessage = 'No used-gear workflow row is linked to this listing yet.',
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--bg)]" />
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
  const activeIndex = getActiveTimelineIndex(summary.timeline);
  const statusPresentation = getWorkflowStatusPresentation(summary.workflowStatus);
  const progressPercent = summary.timeline.length > 0
    ? Math.max((completedCount / summary.timeline.length) * 100, completedCount > 0 ? 8 : 0)
    : 0;

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Process Overview</p>
              <h5 className="m-0 mt-2 text-sm font-semibold text-[var(--ink)]">{completedCount} of {summary.timeline.length} milestones completed</h5>
              <p className="m-0 mt-2 text-sm text-[var(--ink)]">{statusPresentation.statusLabel}</p>
              <p className="m-0 mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{statusPresentation.statusDescription}</p>
            </div>
            <span className="rounded-full border border-[var(--line)] bg-white/5 px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
              Intake {summary.workflowIntakeDecision}
            </span>
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
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/25">
            <div className={[
              'h-full rounded-full transition-[width]',
              statusPresentation.progressClassName,
            ].join(' ')} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <div>Current Stage</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">{summary.workflowStatus}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <div>{statusPresentation.nextTeamLabel}</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">{summary.workflowNextTeam || 'No open handoff'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <div>Resolved Price</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">{summary.resolvedPrice || 'Missing price'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.08em]">{summary.priceSourceFieldName || 'No price field found'}</div>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
              <div>Pre-Listing Reviewer</div>
              <div className="mt-1 font-semibold text-[var(--ink)]">{summary.preListingReviewedBy || 'Not signed yet'}</div>
            </div>
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
          <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Resolved Listing Content</p>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
            <div>Resolved Title</div>
            <div className="mt-1 font-semibold text-[var(--ink)]">{summary.resolvedTitle || 'Missing title'}</div>
          </div>
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-white/5 px-3 py-3 text-sm text-[var(--muted)]">
            <div className="font-semibold text-[var(--ink)]">Resolved Description</div>
            <div className="mt-1 line-clamp-6 whitespace-pre-wrap leading-6">{summary.resolvedDescription || 'No description resolved yet.'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="m-0 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Milestones</p>
        <div className="mt-3 space-y-3">
          {summary.timeline.map((entry, index) => {
            const isCompleted = entry.status === 'completed';
            const isActive = !isCompleted && index === activeIndex;
            const isLast = index === summary.timeline.length - 1;

            return (
              <div
                key={entry.id}
                className="flex gap-4"
              >
                <div className="relative flex w-10 shrink-0 justify-center pt-1" aria-hidden="true">
                  {!isLast ? (
                    <span
                      className={[
                        'absolute left-1/2 top-6 ml-[-1px] h-[calc(100%+1rem)] w-0.5',
                        getTimelineConnectorClassName(entry, index, activeIndex),
                      ].join(' ')}
                    />
                  ) : null}
                  <span
                    className={[
                      'relative z-10 mt-1 inline-flex h-4 w-4 rounded-full border-2 transition-colors',
                      getTimelineDotClassName(entry, index, activeIndex),
                    ].join(' ')}
                  />
                </div>
                <div
                  className={[
                    'min-w-0 flex-1 rounded-xl border px-4 py-3 transition-colors',
                    getTimelineCardClassName(entry, index, activeIndex),
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Step {index + 1}</p>
                      <span className="mt-1 block text-sm font-semibold text-[var(--ink)]">{entry.label}</span>
                    </div>
                    <span className={[
                      'rounded-full border px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.08em]',
                      isCompleted
                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                        : isActive
                          ? 'border-amber-400/35 bg-amber-500/15 text-amber-100'
                          : 'border-[var(--line)] bg-white/5 text-[var(--muted)]',
                    ].join(' ')}>
                      {isCompleted ? 'Completed' : isActive ? 'Current' : 'Pending'}
                    </span>
                  </div>
                  <p className="m-0 mt-2 text-sm text-[var(--muted)]">{formatTimelineTimestamp(entry.timestamp)}</p>
                  {entry.actor ? (
                    <p className="m-0 mt-1 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">By {entry.actor}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ListingApprovalWorkflowSummary({ summary }: ListingApprovalWorkflowSummaryProps) {
  return <ListingApprovalWorkflowProcessCard summary={summary} />;
}