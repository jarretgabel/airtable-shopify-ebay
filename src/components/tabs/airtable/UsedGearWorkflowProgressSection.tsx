import { useEffect, useMemo, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { FilterToggleIconButton } from '@/components/app/FilterToggleIconButton';
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
import { buildWorkflowProgressLastTouchedSummary } from '@/services/usedGearWorkflowLastTouched';
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
  const [showQueueTools, setShowQueueTools] = useState(false);
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
  const hasSecondaryControlsActive = searchTerm.trim().length > 0
    || sortMode !== 'group-label'
    || Boolean(focusedGroupId);

  useEffect(() => {
    if (hasSecondaryControlsActive) {
      setShowQueueTools(true);
    }
  }, [hasSecondaryControlsActive]);

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

  const openLastTouchedAction = (recordId: string, actionTarget: 'review-record' | 'workflow-record' | 'listings-record') => {
    if (actionTarget === 'listings-record') {
      onOpenListingsRecord(recordId);
      return;
    }

    onOpenWorkflowRecord(recordId);
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
                <p className="m-0">{queuePresentation.description}</p>
                <p className="mt-3 mb-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]/80">
                  One clear next step stays on each card. Detailed stage actions live on the workflow record page.
                </p>
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
          <div className="flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-2 py-2">
              <CopyLinkIconButton
                onClick={() => {
                  void copyLink();
                }}
                disabled={copyingLink}
                copying={copyingLink}
                copied={copiedLink}
                label="Copy Queue Link"
                copyingLabel="Copying queue link"
                copiedLabel="Queue link copied"
              />
            <RefreshIconButton
              onClick={() => {
                void refreshQueue();
              }}
              disabled={refreshing}
              loading={refreshing}
              label="Refresh workflow progress queue"
              loadingLabel="Refreshing workflow progress queue"
            />
            </div>
            <FilterToggleIconButton
              onClick={() => setShowQueueTools((current) => !current)}
              aria-expanded={showQueueTools}
              expanded={showQueueTools}
              collapsedLabel="Show Filters And Tools"
              expandedLabel="Hide Filters And Tools"
            />
          </div>
        </div>
      </div>

      {showQueueTools ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4">
          <div className="grid gap-3 lg:grid-cols-1 lg:items-end">
            <label className="min-w-[180px]">
              <span className="sr-only">Sort used gear progress queue</span>
              <select
                className={inputClassName}
                value={sortMode}
                onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearWorkflowProgressSortMode)}
              >
                <option value="group-label">Sort: Group Label</option>
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Rows</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Groups</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{groupedRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">5+ Days In Stage</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{agingSummary.alertCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Oldest Active Stage</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{formatUsedGearAgeDays(agingSummary.oldestAgeDays)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
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
          {queuePresentation.sharedFocusMessage}
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
                <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{group.label}</h4>
                <div className="mt-2 max-w-xl">
                  <CollapsibleHelperText label="Group details">
                    {group.description}
                  </CollapsibleHelperText>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {group.records.length} row{group.records.length === 1 ? '' : 's'}
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1">
                  <CopyLinkIconButton
                    onClick={() => {
                      void copyLink(buildWorkflowProgressGroupLink(group.id, groupParamName, sectionId));
                    }}
                    disabled={copyingLink}
                    copying={copyingLink}
                    copied={copiedLink}
                    label="Copy Group Link"
                    copyingLabel="Copying group link"
                    copiedLabel="Group link copied"
                    className="h-7 w-7 rounded-full border-transparent bg-transparent shadow-none hover:bg-[var(--line)]"
                  />
                </div>
                {focusedGroupId ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onFocusedGroupIdChange?.(null)}
                  >
                    Show All Groups
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const status = getUsedGearWorkflowStatus(record.fields) ?? 'Unknown';
                const lastTouchedSummary = buildWorkflowProgressLastTouchedSummary(record);

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
                      <div>Next Team: {displayInventoryValue(record.fields['Workflow Next Team'])}</div>
                      <div>
                        Price Ready: {getUsedGearWorkflowListingReadiness(record).price ? 'Yes' : 'No'}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-3 block w-full rounded-xl border border-[var(--line)] bg-[var(--bg)]/70 px-3 py-3 text-left text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]"
                      onClick={() => openLastTouchedAction(record.id, lastTouchedSummary.actionTarget)}
                    >
                      <span className="font-semibold text-[var(--ink)]">Last touched:</span> {lastTouchedSummary.description} · {lastTouchedSummary.timestamp}
                      <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{lastTouchedSummary.actionLabel}</span>
                    </button>

                    <details className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-3 py-3 text-sm text-[var(--muted)]">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        More Stage Details
                      </summary>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>Processing Signed: {displayInventoryValue(record.fields['Processing Signed By'])}</div>
                        <div>Testing Signed: {displayInventoryValue(record.fields['Testing Signed By'])}</div>
                        <div>Photography Signed: {displayInventoryValue(record.fields['Photography Signed By'])}</div>
                      </div>
                      {status === 'Approved for Publish' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={smallSecondaryActionButtonClass}
                            onClick={() => onOpenWorkflowRecord(record.id)}
                          >
                            Open Workflow Record
                          </button>
                        </div>
                      ) : null}
                    </details>

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