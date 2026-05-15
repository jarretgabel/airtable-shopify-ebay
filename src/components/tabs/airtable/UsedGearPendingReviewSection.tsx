import { useEffect, useMemo, useState } from 'react';
import { smallPrimaryActionButtonClass, smallSecondaryActionButtonClass } from '@/components/app/buttonStyles';
import { CollapsibleHelperText } from '@/components/app/CollapsibleHelperText';
import { CopyLinkIconButton } from '@/components/app/CopyLinkIconButton';
import { FilterToggleIconButton } from '@/components/app/FilterToggleIconButton';
import { RefreshIconButton } from '@/components/app/RefreshIconButton';
import { EmptySurface } from '@/components/app/StateSurfaces';
import {
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadPendingReviewQueue,
} from '@/services/usedGearQueue';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  buildPendingReviewQueueAgingSummary,
  formatUsedGearAgeDays,
} from '@/services/usedGearWorkflowAging';
import { buildPendingReviewLastTouchedSummary } from '@/services/usedGearWorkflowLastTouched';
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

function buildPendingReviewGroupLink(groupId: string): string {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('workflowPendingReviewGroup', groupId);
  nextUrl.hash = 'used-gear-pending-review';
  return nextUrl.toString();
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
  const [showQueueTools, setShowQueueTools] = useState(false);
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
  const agingSummary = useMemo(() => buildPendingReviewQueueAgingSummary(filteredRecords), [filteredRecords]);
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

  const openLastTouchedAction = (recordId: string) => {
    onOpenReviewRecord(recordId);
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
                Review new intake rows, confirm they are qualified, and send each item into the right next step.
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
              label="Refresh pending review queue"
              loadingLabel="Refreshing pending review queue"
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
              <span className="sr-only">Sort pending review queue</span>
              <select
                className={inputClassName}
                value={sortMode}
                onChange={(event) => handleSortModeChange(event.currentTarget.value as UsedGearPendingReviewSortMode)}
              >
                <option value="group-label">Sort: Group Label</option>
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="arrival-date">Sort: Arrival Date</option>
                <option value="make-model">Sort: Make Then Model</option>
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
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">3+ Days In Review</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{agingSummary.alertCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Oldest Pending</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{formatUsedGearAgeDays(agingSummary.oldestAgeDays)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Groups</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{groupedRecords.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
        Groups: <span className="font-semibold text-[var(--ink)]">{groupedRecords.length}</span>
        {' · '}
        Total Pending: <span className="font-semibold text-[var(--ink)]">{records.length}</span>
      </div>

      {!loading && records.length === 0 ? (
        <EmptySurface title="Pending review queue is clear" message="No used-gear workflow rows currently need initial intake review.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: check Parking Lot 1 for fresh customer submissions, or use the manual Incoming Gear form when intake starts inside the app.
          </p>
        </EmptySurface>
      ) : null}

      {focusedGroupId ? (
        <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          Shared link opened the pending-review queue focused on one grouped submission.
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
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.description}</p>
                <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{group.label}</h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {group.records.length} row{group.records.length === 1 ? '' : 's'}
                </div>
                {onOpenGroupReview ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onOpenGroupReview(group.id)}
                  >
                    Open Group Review
                  </button>
                ) : null}
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] px-1.5 py-1">
                  <CopyLinkIconButton
                    onClick={() => {
                      void copyLink(buildPendingReviewGroupLink(group.id));
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

            <div className="mt-4 space-y-3">
              {group.records.length > 1 && groupNeedsSubmissionId ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 text-sm text-[var(--muted)]">
                  <p className="m-0 text-amber-300">This group still needs a shared Submission Group ID before it can be accepted into Lot 2.</p>
                </div>
              ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const hasPricingPath = hasUsedGearPendingReviewPricingPath(record.fields);
                const lastTouchedSummary = buildPendingReviewLastTouchedSummary(record);

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
                        <span className="font-semibold text-[var(--ink)]">Pricing Gate:</span> {hasPricingPath ? 'Ready' : 'Missing'}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Offer Amount:</span> {displayInventoryValue(record.fields['Offer Amount'])}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {previewText(record.fields['Qualification Notes'])}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-3 block w-full rounded-xl border border-[var(--line)] bg-[var(--bg)]/70 px-3 py-3 text-left text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]"
                      onClick={() => openLastTouchedAction(record.id)}
                    >
                      <span className="font-semibold text-[var(--ink)]">Last touched:</span> {lastTouchedSummary.description} · {lastTouchedSummary.timestamp}
                      <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{lastTouchedSummary.actionLabel}</span>
                    </button>

                    <details className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 px-3 py-3 text-sm text-[var(--muted)]">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        More Item Details
                      </summary>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Submission Group:</span> {displayInventoryValue(record.fields['Submission Group ID'])}
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--ink)]">Paid Amount:</span> {displayInventoryValue(record.fields['Paid Amount'])}
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-semibold text-[var(--ink)]">Customer Notes:</span> {previewText(record.fields['Customer Functional Notes'] || record.fields['Customer Cosmetic Notes'] || record.fields['Customer Inclusion Notes'])}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={smallSecondaryActionButtonClass}
                          onClick={() => onOpenWorkflowRecord(record.id)}
                        >
                          Workflow Detail
                        </button>
                      </div>
                    </details>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={smallPrimaryActionButtonClass}
                        onClick={() => onOpenReviewRecord(record.id)}
                      >
                        {group.records.length > 1 ? 'Open Item Review' : 'Open Review'}
                      </button>
                      {groupNeedsSubmissionId ? (
                        <span className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">Needs group submission ID</span>
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