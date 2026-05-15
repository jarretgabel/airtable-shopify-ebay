import { useEffect, useMemo, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { EmptySurface } from '@/components/app/StateSurfaces';
import {
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadPendingReviewQueue,
} from '@/services/usedGearQueue';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearPendingReviewSectionProps {
  currentUserName: string;
  onOpenGroupReview?: (groupId: string) => void;
  onOpenReviewRecord: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  showSectionIntro?: boolean;
  focusedGroupId?: string | null;
  onFocusedGroupIdChange?: (groupId: string | null) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearPendingReviewSortMode;
  onSortModeChange?: (value: UsedGearPendingReviewSortMode) => void;
}

export type UsedGearPendingReviewSortMode = 'group-label' | 'newest' | 'oldest' | 'arrival-date' | 'make-model';

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Source'],
    record.fields['Submission Group ID'],
    record.fields['Pick Up ID'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function stringFieldValue(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  return typeof value === 'string' ? value : '';
}

function arrivalTimestamp(record: AirtableRecord): number {
  const rawValue = stringFieldValue(record, 'Arrival Date');
  const parsed = rawValue ? Date.parse(rawValue) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function makeModelSortValue(record: AirtableRecord): string {
  return `${stringFieldValue(record, 'Make')} ${stringFieldValue(record, 'Model')} ${stringFieldValue(record, 'SKU')}`.trim().toLowerCase();
}

function previewText(value: unknown): string {
  const normalized = displayInventoryValue(value);
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

const intakeDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function getRecordIntakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = stringFieldValue(record, 'Arrival Date');
  const parsedArrival = arrivalDate ? Date.parse(arrivalDate) : Number.NaN;
  if (Number.isFinite(parsedArrival)) {
    return parsedArrival;
  }

  const createdTime = Date.parse(record.createdTime);
  return Number.isFinite(createdTime) ? createdTime : Number.POSITIVE_INFINITY;
}

function formatIntakeDate(record: AirtableRecord): string {
  const intakeTimestamp = getRecordIntakeTimestamp(record);
  if (Number.isFinite(intakeTimestamp)) {
    return intakeDateFormatter.format(new Date(intakeTimestamp));
  }

  return 'Unknown';
}

function formatGroupIntakeDate(records: AirtableRecord[]): string {
  const earliestTimestamp = Math.min(...records.map(getRecordIntakeTimestamp));
  if (Number.isFinite(earliestTimestamp)) {
    return intakeDateFormatter.format(new Date(earliestTimestamp));
  }

  return 'Unknown';
}

function getGroupHeading(description: string): string {
  if (description === 'Single record') {
    return 'Single intake item';
  }
  if (description === 'Pickup group') {
    return 'Pickup set';
  }
  if (description === 'Submission group') {
    return 'Submission set';
  }
  return description;
}

function buildPendingReviewGroupLink(groupId: string): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('workflowPendingReviewGroup', groupId);
  nextUrl.hash = 'used-gear-pending-review';
  return nextUrl.toString();
}

function getPendingReviewSortLabel(sortMode: UsedGearPendingReviewSortMode): string {
  if (sortMode === 'newest') return 'Newest First';
  if (sortMode === 'oldest') return 'Oldest First';
  if (sortMode === 'arrival-date') return 'Arrival Date';
  if (sortMode === 'make-model') return 'Make Then Model';
  return 'Default Order';
}

export function UsedGearPendingReviewSection({
  onOpenGroupReview,
  onOpenReviewRecord,
  onOpenWorkflowRecord,
  showSectionIntro = true,
  focusedGroupId = null,
  onFocusedGroupIdChange,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearPendingReviewSectionProps) {
  const { copyingLink, copiedLink, copyLink } = useCopyQueueLink({
    sectionId: 'used-gear-pending-review',
    successTitle: 'Queue link copied',
    successMessage: 'The pending review queue link is ready to share.',
    unavailableMessage: 'This browser cannot copy the pending review queue link automatically.',
    failureMessage: 'The pending review queue link could not be copied. Try again or copy the URL from the browser address bar.',
  });
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearPendingReviewSortMode>('group-label');
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadPendingReviewQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the pending review queue.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return records.filter((record) => {
      if (!normalizedSearch) {
        return true;
      }

      return recordSearchText(record).includes(normalizedSearch);
    });
  }, [records, searchTerm]);

  const groupedRecords = useMemo(() => {
    const groups = groupUsedGearWorkflowRecords(filteredRecords);
    const getNewestTimestamp = (group: (typeof groups)[number]) => Math.max(...group.records.map((record) => new Date(record.createdTime).getTime()));
    const getOldestTimestamp = (group: (typeof groups)[number]) => Math.min(...group.records.map((record) => new Date(record.createdTime).getTime()));
    const getEarliestArrival = (group: (typeof groups)[number]) => Math.min(...group.records.map(arrivalTimestamp));
    const getLowestMakeModel = (group: (typeof groups)[number]) => [...group.records]
      .sort((left, right) => makeModelSortValue(left).localeCompare(makeModelSortValue(right)))[0];

    return [...groups].sort((left, right) => {
      if (sortMode === 'newest') {
        return getNewestTimestamp(right) - getNewestTimestamp(left) || left.label.localeCompare(right.label);
      }
      if (sortMode === 'oldest') {
        return getOldestTimestamp(left) - getOldestTimestamp(right) || left.label.localeCompare(right.label);
      }
      if (sortMode === 'arrival-date') {
        return getEarliestArrival(left) - getEarliestArrival(right) || left.label.localeCompare(right.label);
      }
      if (sortMode === 'make-model') {
        const leftRecord = getLowestMakeModel(left);
        const rightRecord = getLowestMakeModel(right);
        return makeModelSortValue(leftRecord).localeCompare(makeModelSortValue(rightRecord)) || left.label.localeCompare(right.label);
      }
      return left.label.localeCompare(right.label);
    });
  }, [filteredRecords, sortMode]);
  const visibleGroups = useMemo(
    () => (focusedGroupId ? groupedRecords.filter((group) => group.id === focusedGroupId) : groupedRecords),
    [focusedGroupId, groupedRecords],
  );
  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadPendingReviewQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the pending review queue.');
    } finally {
      setRefreshing(false);
    }
  };

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const handleSortModeChange = (value: UsedGearPendingReviewSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  return (
    <section id="used-gear-pending-review" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <div>
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Pending Review Queue</h3>
            <div className="mt-3 max-w-2xl">
              <CollapsibleHelperText label="Queue guide">
                Review new intake rows and move qualified items into the next step.
              </CollapsibleHelperText>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Search pending review queue</span>
            <input
              type="text"
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => handleSearchTermChange(event.currentTarget.value)}
              placeholder="Search by SKU, make, model, source, or group id"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh pending review queue"
              loadingLabel="Refreshing pending review queue"
            />
            <div className="relative h-10 w-10 shrink-0">
              <div
                aria-hidden="true"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_4px_14px_rgba(17,32,49,0.04)] transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-[var(--line)] hover:text-[var(--ink)]"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path d="M4.167 5.417h9.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M4.167 10h6.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M4.167 14.583h4.166" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="M14.583 4.167v11.666" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  <path d="m12.5 6.25 2.083-2.083 2.084 2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m12.5 13.75 2.083 2.083 2.084-2.083" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <select
                aria-label={`Sort pending review queue. Current order: ${getPendingReviewSortLabel(sortMode)}`}
                className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
                value={sortMode}
                onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearPendingReviewSortMode)}
              >
                <option value="group-label">Default Order</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="arrival-date">Arrival Date</option>
                <option value="make-model">Make Then Model</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <EmptySurface title="Pending review queue is clear" message="No used-gear workflow rows currently need initial intake review.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: check Parking Lot 1 for fresh customer submissions, or use the manual Incoming Gear form when intake starts inside the app.
          </p>
        </EmptySurface>
      ) : null}

      {focusedGroupId ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Shared link opened the pending-review queue focused on one queue set.
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading pending review queue...
          </div>
        ) : visibleGroups.map((group) => {
          const groupNeedsSubmissionId = group.records.length > 1
            && group.records.some((record) => stringFieldValue(record, 'Submission Group ID').trim().length === 0);

          return (
          <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{getGroupHeading(group.description)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Earliest intake {formatGroupIntakeDate(group.records)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenGroupReview ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onOpenGroupReview(group.id)}
                  >
                    {group.records.length === 1 ? 'Open Review' : 'Open Group Review'}
                  </button>
                ) : null}
                <CopyLinkIconButton
                  onClick={() => {
                    void copyLink(buildPendingReviewGroupLink(group.id));
                  }}
                  disabled={copyingLink}
                  copying={copyingLink}
                  copied={copiedLink}
                  label={group.records.length === 1 ? 'Copy Item Link' : 'Copy Group Link'}
                  copyingLabel={group.records.length === 1 ? 'Copying item link' : 'Copying group link'}
                  copiedLabel={group.records.length === 1 ? 'Item link copied' : 'Group link copied'}
                  className="h-7 w-7 rounded-full"
                />
                {focusedGroupId ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onFocusedGroupIdChange?.(null)}
                  >
                    Show All Sets
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {group.records.length > 1 && groupNeedsSubmissionId ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 text-sm text-[var(--muted)]">
                  <p className="m-0 text-amber-300">This set still needs a shared Submission Group ID before it can be accepted into Lot 2.</p>
                </div>
              ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const hasPricingPath = hasUsedGearPendingReviewPricingPath(record.fields);

                return (
                  <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{displayInventoryValue(record.fields['Workflow Source'])}</p>
                        <h5 className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h5>
                        <p className="mt-1 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                      </div>
                      <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {displayInventoryValue(record.fields['Workflow Status'])}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Intake Date:</span> {formatIntakeDate(record)}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Pricing Gate:</span> {hasPricingPath ? 'Ready' : 'Missing'}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Offer Amount:</span> {displayInventoryValue(record.fields['Offer Amount'])}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {previewText(record.fields['Qualification Notes'])}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={smallPrimaryActionButtonClass}
                        onClick={() => onOpenReviewRecord(record.id)}
                      >
                        {group.records.length > 1 ? 'Open Item Review' : 'Open Review'}
                      </button>
                      <button
                        type="button"
                        className={smallSecondaryActionButtonClass}
                        onClick={() => onOpenWorkflowRecord(record.id)}
                      >
                        Workflow Detail
                      </button>
                      {groupNeedsSubmissionId ? (
                        <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">Needs shared submission ID</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
            </div>
          </div>
        );
        })}
      </div>
    </section>
  );
}