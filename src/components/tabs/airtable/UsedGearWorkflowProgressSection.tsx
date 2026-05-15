import { useEffect, useMemo, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import {
  getUsedGearWorkflowPrimaryAction,
  groupUsedGearWorkflowRecords,
  loadWorkflowProgressQueue,
} from '@/services/usedGearQueue';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import {
  buildWorkflowProgressQueueAgingSummary,
  formatUsedGearAgeDays,
} from '@/services/usedGearWorkflowAging';
import { getUsedGearWorkflowListingReadiness } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearWorkflowProgressSectionProps {
  currentUserName: string;
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  showSectionIntro?: boolean;
  queueMode?: UsedGearWorkflowProgressQueueMode;
  sectionId?: string;
  groupParamName?: string;
  focusedGroupId?: string | null;
  onFocusedGroupIdChange?: (groupId: string | null) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearWorkflowProgressSortMode;
  onSortModeChange?: (value: UsedGearWorkflowProgressSortMode) => void;
}

export type UsedGearWorkflowProgressSortMode = 'group-label' | 'newest' | 'oldest';
export type UsedGearWorkflowProgressQueueMode = 'all' | 'testing' | 'photography' | 'pre-listing';

function getWorkflowProgressSortLabel(sortMode: UsedGearWorkflowProgressSortMode): string {
  if (sortMode === 'newest') return 'Newest First';
  if (sortMode === 'oldest') return 'Oldest First';
  return 'Default Order';
}

interface ProgressQueuePresentation {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyMessage: string;
  emptyGuidance: string;
  copySuccessTitle: string;
  copySuccessMessage: string;
  copyUnavailableMessage: string;
  copyFailureMessage: string;
  sharedFocusMessage: string;
}

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Status'],
    record.fields['Workflow Next Team'],
    record.fields['Submission Group ID'],
    record.fields['Pick Up ID'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function isConcurrentStageStatus(record: AirtableRecord): boolean {
  return getUsedGearWorkflowStatus(record.fields) === 'Testing and Photography In Progress';
}

function isAwaitingPreListingStatus(record: AirtableRecord): boolean {
  return getUsedGearWorkflowStatus(record.fields) === 'Awaiting Pre-Listing Review';
}

function buildWorkflowProgressGroupLink(groupId: string, groupParamName: string, sectionId: string): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(groupParamName, groupId);
  nextUrl.hash = sectionId;
  return nextUrl.toString();
}

const intakeDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function getRecordIntakeTimestamp(record: AirtableRecord): number {
  const arrivalDate = typeof record.fields['Arrival Date'] === 'string' ? record.fields['Arrival Date'].trim() : '';
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

function getGroupHeading(description: string): string {
  if (description === 'Single record') {
    return 'Single workflow item';
  }
  if (description === 'Pickup group') {
    return 'Pickup set';
  }
  if (description === 'Submission group') {
    return 'Submission set';
  }
  return description;
}

function getStageReviewLabel(status: string): string {
  if (status === 'Awaiting Pre-Listing Review') {
    return 'Open Pre-Listing Review';
  }

  if (status === 'Approved for Publish') {
    return 'Open Publish Review';
  }

  if (status === 'Testing and Photography In Progress') {
    return 'Open Stage Review';
  }

  return 'Open Stage Review';
}

function getQueuePresentation(queueMode: UsedGearWorkflowProgressQueueMode): ProgressQueuePresentation {
  if (queueMode === 'testing') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Testing Queue',
      description: 'Focus only on rows still waiting for testing signoff. Related rows stay grouped by pickup or submission so multi-item work stays coherent.',
      emptyTitle: 'No rows currently need testing',
      emptyMessage: 'The testing queue is clear. Rows that still need testing will appear here automatically.',
      emptyGuidance: 'Next route: move accepted rows through Parking Lot 2 and complete processing so testing work can begin.',
      copySuccessTitle: 'Testing queue link copied',
      copySuccessMessage: 'The testing queue link is ready to share.',
      copyUnavailableMessage: 'This browser cannot copy the testing queue link automatically.',
      copyFailureMessage: 'The testing queue link could not be copied. Try again or copy the URL from the browser address bar.',
      sharedFocusMessage: 'Shared link opened the testing queue focused on one grouped submission.',
    };
  }

  if (queueMode === 'photography') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Photography Queue',
      description: 'Focus only on rows still waiting for photography signoff. Related rows stay grouped by pickup or submission so staging work can be handed off cleanly.',
      emptyTitle: 'No rows currently need photography',
      emptyMessage: 'The photography queue is clear. Rows that still need photography will appear here automatically.',
      emptyGuidance: 'Next route: use Parking Lot 2 or the testing queue until rows are ready for photo-stage completion.',
      copySuccessTitle: 'Photography queue link copied',
      copySuccessMessage: 'The photography queue link is ready to share.',
      copyUnavailableMessage: 'This browser cannot copy the photography queue link automatically.',
      copyFailureMessage: 'The photography queue link could not be copied. Try again or copy the URL from the browser address bar.',
      sharedFocusMessage: 'Shared link opened the photography queue focused on one grouped submission.',
    };
  }

  if (queueMode === 'pre-listing') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Pre-Listing Queue',
      description: 'Focus only on rows that cleared testing and photography and are ready for pre-listing review before publish handoff.',
      emptyTitle: 'No rows currently need pre-listing review',
      emptyMessage: 'The pre-listing queue is clear. Rows that finish both concurrent stages will appear here automatically.',
      emptyGuidance: 'Next route: finish testing and photography work so rows can advance into pre-listing review.',
      copySuccessTitle: 'Pre-listing queue link copied',
      copySuccessMessage: 'The pre-listing queue link is ready to share.',
      copyUnavailableMessage: 'This browser cannot copy the pre-listing queue link automatically.',
      copyFailureMessage: 'The pre-listing queue link could not be copied. Try again or copy the URL from the browser address bar.',
      sharedFocusMessage: 'Shared link opened the pre-listing queue focused on one grouped submission.',
    };
  }

  return {
    eyebrow: 'Used Gear Workflow',
    title: 'Processing And Stage Queue',
    description: 'Manage accepted intake rows through processing, concurrent testing and photography, and pre-listing publish readiness. Related rows stay grouped by pickup or submission.',
    emptyTitle: 'No active workflow rows in processing',
    emptyMessage: 'The used-gear queue currently has no accepted rows in processing or concurrent stage work.',
    emptyGuidance: 'Next route: review Parking Lot 2 for newly accepted arrivals, or open Listings if the next work item is already approved for publish.',
    copySuccessTitle: 'Queue link copied',
    copySuccessMessage: 'The processing and stage queue link is ready to share.',
    copyUnavailableMessage: 'This browser cannot copy the processing and stage queue link automatically.',
    copyFailureMessage: 'The processing and stage queue link could not be copied. Try again or copy the URL from the browser address bar.',
    sharedFocusMessage: 'Shared link opened the progress queue focused on one grouped submission.',
  };
}

export function UsedGearWorkflowProgressSection({
  showSectionIntro = true,
  onOpenWorkflowRecord,
  onOpenListingsRecord,
  queueMode = 'all',
  sectionId = 'used-gear-progress-queue',
  groupParamName = 'workflowProgressGroup',
  focusedGroupId = null,
  onFocusedGroupIdChange,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearWorkflowProgressSectionProps) {
  const queuePresentation = getQueuePresentation(queueMode);
  const { copyingLink, copiedLink, copyLink } = useCopyQueueLink({
    sectionId,
    successTitle: queuePresentation.copySuccessTitle,
    successMessage: queuePresentation.copySuccessMessage,
    unavailableMessage: queuePresentation.copyUnavailableMessage,
    failureMessage: queuePresentation.copyFailureMessage,
  });
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearWorkflowProgressSortMode>('group-label');
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadWorkflowProgressQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the used-gear progress queue.');
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

  const queueScopedRecords = useMemo(() => {
    if (queueMode === 'testing') {
      return records.filter((record) => isConcurrentStageStatus(record) && !record.fields['Testing Signed By']);
    }

    if (queueMode === 'photography') {
      return records.filter((record) => isConcurrentStageStatus(record) && !record.fields['Photography Signed By']);
    }

    if (queueMode === 'pre-listing') {
      return records.filter((record) => isAwaitingPreListingStatus(record));
    }

    return records;
  }, [queueMode, records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return queueScopedRecords.filter((record) => {
      if (!normalizedSearch) {
        return true;
      }

      return recordSearchText(record).includes(normalizedSearch);
    });
  }, [queueScopedRecords, searchTerm]);

  const groupedRecords = useMemo(() => {
    const groups = groupUsedGearWorkflowRecords(filteredRecords);
    const getNewestTimestamp = (group: (typeof groups)[number]) => Math.max(...group.records.map((record) => new Date(record.createdTime).getTime()));
    const getOldestTimestamp = (group: (typeof groups)[number]) => Math.min(...group.records.map((record) => new Date(record.createdTime).getTime()));

    return [...groups].sort((left, right) => {
      if (sortMode === 'newest') {
        return getNewestTimestamp(right) - getNewestTimestamp(left) || left.label.localeCompare(right.label);
      }
      if (sortMode === 'oldest') {
        return getOldestTimestamp(left) - getOldestTimestamp(right) || left.label.localeCompare(right.label);
      }
      return left.label.localeCompare(right.label);
    });
  }, [filteredRecords, sortMode]);
  const visibleGroups = useMemo(
    () => (focusedGroupId ? groupedRecords.filter((group) => group.id === focusedGroupId) : groupedRecords),
    [focusedGroupId, groupedRecords],
  );
  const agingSummary = useMemo(() => buildWorkflowProgressQueueAgingSummary(filteredRecords), [filteredRecords]);
  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadWorkflowProgressQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the used-gear progress queue.');
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

  const handleSortModeChange = (value: UsedGearWorkflowProgressSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  return (
    <section id={sectionId} className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <div>
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{queuePresentation.eyebrow}</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{queuePresentation.title}</h3>
            <div className="mt-3 max-w-2xl">
              <CollapsibleHelperText label="Queue guide">
                Keep this queue focused on the next handoff. Open the workflow record for detailed stage actions.
              </CollapsibleHelperText>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Search used gear progress queue</span>
            <input
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => handleSearchTermChange(event.currentTarget.value)}
              placeholder="Search by status, SKU, model, group, or next team"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh workflow progress queue"
              loadingLabel="Refreshing workflow progress queue"
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
                aria-label={`Sort used gear progress queue. Current order: ${getWorkflowProgressSortLabel(sortMode)}`}
                className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
                value={sortMode}
                onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearWorkflowProgressSortMode)}
              >
                <option value="group-label">Default Order</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
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

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
        Visible Rows: <span className="font-semibold text-[var(--ink)]">{filteredRecords.length}</span>
        {' · '}
        Visible Sets: <span className="font-semibold text-[var(--ink)]">{groupedRecords.length}</span>
        {' · '}
        5+ Days In Stage: <span className="font-semibold text-[var(--ink)]">{agingSummary.alertCount}</span>
        {' · '}
        Oldest Active Stage: <span className="font-semibold text-[var(--ink)]">{formatUsedGearAgeDays(agingSummary.oldestAgeDays)}</span>
      </div>

      {!loading && groupedRecords.length === 0 ? (
        <EmptySurface title={queuePresentation.emptyTitle} message={queuePresentation.emptyMessage}>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {queuePresentation.emptyGuidance}
          </p>
        </EmptySurface>
      ) : null}

      {focusedGroupId ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Focused on one workflow set from a shared queue link.
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading used-gear progress queue...
          </div>
        ) : visibleGroups.map((group) => {
          return (
          <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{getGroupHeading(group.description)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {group.records.length === 1 ? 'Single item' : `${group.records.length} rows`}
                </div>
                <CopyLinkIconButton
                  onClick={() => {
                    void copyLink(buildWorkflowProgressGroupLink(group.id, groupParamName, sectionId));
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

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const status = getUsedGearWorkflowStatus(record.fields) ?? 'Unknown';

                return (
                  <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{status}</p>
                        <h5 className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h5>
                        <p className="mt-1 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                      </div>
                      <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        {getUsedGearWorkflowPrimaryAction(record)}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Intake Date:</span> {formatIntakeDate(record)}
                      </div>
                      <div>Next Team: {displayInventoryValue(record.fields['Workflow Next Team'])}</div>
                      <div>
                        Price Ready: {getUsedGearWorkflowListingReadiness(record).price ? 'Yes' : 'No'}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={smallPrimaryActionButtonClass}
                        onClick={() => {
                          if (status === 'Approved for Publish') {
                            onOpenListingsRecord(record.id);
                            return;
                          }

                          onOpenWorkflowRecord(record.id);
                        }}
                      >
                        {status === 'Approved for Publish' ? 'Open Listings Approval' : getStageReviewLabel(status)}
                      </button>
                      <button
                        type="button"
                        className={smallSecondaryActionButtonClass}
                        onClick={() => onOpenWorkflowRecord(record.id)}
                      >
                        Workflow Detail
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>
    </section>
  );
}