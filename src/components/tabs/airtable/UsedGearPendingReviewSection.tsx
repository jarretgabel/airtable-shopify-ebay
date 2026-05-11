import { useEffect, useMemo, useState } from 'react';
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
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearPendingReviewSectionProps {
  currentUserName: string;
  onOpenGroupReview?: (groupId: string) => void;
  onOpenReviewRecord: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  focusedGroupId?: string | null;
  onFocusedGroupIdChange?: (groupId: string | null) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  collapsedGroupIds?: string[];
  onCollapsedGroupIdsChange?: (groupIds: string[]) => void;
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
  currentUserName,
  onOpenGroupReview,
  onOpenReviewRecord,
  onOpenWorkflowRecord,
  focusedGroupId = null,
  onFocusedGroupIdChange,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  collapsedGroupIds: controlledCollapsedGroupIds,
  onCollapsedGroupIdsChange,
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
  const [uncontrolledCollapsedGroupIds, setUncontrolledCollapsedGroupIds] = useState<string[]>([]);
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearPendingReviewSortMode>('group-label');
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const collapsedGroupIds = Array.isArray(controlledCollapsedGroupIds) ? controlledCollapsedGroupIds : uncontrolledCollapsedGroupIds;
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
    if (!normalizedSearch) {
      return records;
    }

    return records.filter((record) => recordSearchText(record).includes(normalizedSearch));
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
  const visibleGroupIds = useMemo(() => visibleGroups.map((group) => group.id), [visibleGroups]);
  const collapsedGroupIdSet = useMemo(() => new Set(collapsedGroupIds), [collapsedGroupIds]);
  const allVisibleGroupsCollapsed = visibleGroupIds.length > 0
    && visibleGroupIds.every((groupId) => collapsedGroupIdSet.has(groupId));

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

  const handleCollapsedGroupIdsChange = (groupIds: string[]) => {
    if (!Array.isArray(controlledCollapsedGroupIds)) {
      setUncontrolledCollapsedGroupIds(groupIds);
    }

    onCollapsedGroupIdsChange?.(groupIds);
  };

  const handleSortModeChange = (value: UsedGearPendingReviewSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  const toggleGroupCollapsed = (groupId: string) => {
    const nextCollapsedGroupIds = collapsedGroupIdSet.has(groupId)
      ? collapsedGroupIds.filter((value) => value !== groupId)
      : [...collapsedGroupIds, groupId].sort((left, right) => left.localeCompare(right));

    handleCollapsedGroupIdsChange(nextCollapsedGroupIds);
  };

  const collapseVisibleGroups = () => {
    const nextCollapsedGroupIds = Array.from(new Set([...collapsedGroupIds, ...visibleGroupIds]))
      .sort((left, right) => left.localeCompare(right));

    handleCollapsedGroupIdsChange(nextCollapsedGroupIds);
  };

  const expandVisibleGroups = () => {
    handleCollapsedGroupIdsChange(
      collapsedGroupIds.filter((groupId) => !visibleGroupIds.includes(groupId)),
    );
  };

  return (
    <section id="used-gear-pending-review" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Pending Review Queue</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Review newly-created workflow rows before they enter the accepted intake flow. Choose the correct Lot 2 destination, capture qualification notes, then accept; unqualified sends the row into trash with the required reason.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void copyLink();
            }}
            disabled={copyingLink}
          >
            {copyingLink ? 'Copying...' : copiedLink ? 'Link Copied' : 'Copy Queue Link'}
          </button>
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
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void refreshQueue();
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Queue'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={collapseVisibleGroups}
            disabled={visibleGroupIds.length === 0 || allVisibleGroupsCollapsed}
          >
            Collapse All Groups
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={expandVisibleGroups}
            disabled={visibleGroupIds.length === 0 || collapsedGroupIds.length === 0}
          >
            Expand All Groups
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pending Rows</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{records.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible After Search</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{filteredRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Visible Groups</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{groupedRecords.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">3+ Days In Review</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{agingSummary.alertCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Oldest Pending</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{formatUsedGearAgeDays(agingSummary.oldestAgeDays)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
        Current Reviewer: <span className="font-semibold text-[var(--ink)]">{currentUserName}</span>
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
          const collapsed = collapsedGroupIdSet.has(group.id);
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
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onOpenGroupReview(group.id)}
                  >
                    Open Group Review
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void copyLink(buildPendingReviewGroupLink(group.id));
                  }}
                  disabled={copyingLink}
                >
                  {copyingLink ? 'Copying...' : copiedLink ? 'Link Copied' : 'Copy Group Link'}
                </button>
                {focusedGroupId ? (
                  <button
                    type="button"
                    className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    onClick={() => onFocusedGroupIdChange?.(null)}
                  >
                    Show All Groups
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  onClick={() => toggleGroupCollapsed(group.id)}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? 'Expand Group' : 'Collapse Group'}
                </button>
              </div>
            </div>

            {collapsed ? (
              <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg)] px-4 py-4 text-sm text-[var(--muted)]">
                This submission group is collapsed in the current shared queue view.
              </div>
            ) : (
            <div className="mt-4 space-y-3">
              {group.records.length > 1 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 text-sm text-[var(--muted)]">
                  <p className="m-0 font-semibold text-[var(--ink)]">Grouped intake review has moved off the queue cards.</p>
                  <p className="mt-2 mb-0">Use the dedicated group-review page for shared pricing, allocation, and accept or trash decisions. The cards below stay focused on quick identification and entry into that review flow.</p>
                  {groupNeedsSubmissionId ? (
                    <p className="mt-3 mb-0 text-amber-300">This group still needs a shared Submission Group ID before it can be accepted into Lot 2.</p>
                  ) : null}
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
                        <span className="font-semibold text-[var(--ink)]">Pricing Gate:</span> {hasPricingPath ? 'Ready' : 'Missing'}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Submission Group:</span> {displayInventoryValue(record.fields['Submission Group ID'])}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Offer Amount:</span> {displayInventoryValue(record.fields['Offer Amount'])}
                      </div>
                      <div>
                        <span className="font-semibold text-[var(--ink)]">Paid Amount:</span> {displayInventoryValue(record.fields['Paid Amount'])}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {previewText(record.fields['Qualification Notes'])}
                      </div>
                      <div className="sm:col-span-2">
                        <span className="font-semibold text-[var(--ink)]">Customer Notes:</span> {previewText(record.fields['Customer Functional Notes'] || record.fields['Customer Cosmetic Notes'] || record.fields['Customer Inclusion Notes'])}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                        onClick={() => onOpenReviewRecord(record.id)}
                      >
                        {group.records.length > 1 ? 'Open Item Review' : 'Open Review'}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenWorkflowRecord(record.id)}
                      >
                        Workflow Detail
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
            )}
          </div>
        );
        })}
      </div>
    </section>
  );
}