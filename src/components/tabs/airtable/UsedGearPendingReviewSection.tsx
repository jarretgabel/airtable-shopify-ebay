import { useEffect, useMemo, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import {
  acceptPendingReviewRecord,
  acceptPendingReviewGroup,
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadPendingReviewQueue,
  markPendingReviewUnqualified,
  markPendingReviewGroupUnqualified,
  type UsedGearPendingReviewAcceptedStatus,
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
  onOpenIncomingGearForm: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  collapsedGroupIds?: string[];
  onCollapsedGroupIdsChange?: (groupIds: string[]) => void;
  sortMode?: UsedGearPendingReviewSortMode;
  onSortModeChange?: (value: UsedGearPendingReviewSortMode) => void;
}

export type UsedGearPendingReviewSortMode = 'group-label' | 'newest' | 'oldest' | 'arrival-date' | 'make-model';

const ACCEPT_ROUTE_OPTIONS: Array<{
  value: UsedGearPendingReviewAcceptedStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'Accepted - Awaiting Arrival',
    label: 'Route to Lot 2: Awaiting Arrival',
    description: 'Use when the offer is accepted and the item has not arrived yet.',
  },
  {
    value: 'Accepted - Arrived, Awaiting SKU',
    label: 'Route to Lot 2: Arrived, Awaiting SKU',
    description: 'Use when the item is already on-site and still needs SKU assignment.',
  },
  {
    value: 'Accepted - Arrived, Awaiting Missing Item',
    label: 'Route to Lot 2: Arrived, Awaiting Missing Item',
    description: 'Use when the main intake is accepted but follow-up is still required for a missing unit or accessory.',
  },
];

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

export function UsedGearPendingReviewSection({
  currentUserName,
  onOpenGroupReview,
  onOpenIncomingGearForm,
  onOpenWorkflowRecord,
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
  const [actionTargetId, setActionTargetId] = useState<string | null>(null);
  const [unqualifiedReasons, setUnqualifiedReasons] = useState<Record<string, string>>({});
  const [qualificationNotes, setQualificationNotes] = useState<Record<string, string>>({});
  const [acceptStatuses, setAcceptStatuses] = useState<Record<string, UsedGearPendingReviewAcceptedStatus>>({});
  const [groupQualificationNotes, setGroupQualificationNotes] = useState<Record<string, string>>({});
  const [groupAcceptStatuses, setGroupAcceptStatuses] = useState<Record<string, UsedGearPendingReviewAcceptedStatus>>({});
  const [groupUnqualifiedReasons, setGroupUnqualifiedReasons] = useState<Record<string, string>>({});
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
  const agingSummary = useMemo(() => buildPendingReviewQueueAgingSummary(filteredRecords), [filteredRecords]);
  const visibleGroupIds = useMemo(() => groupedRecords.map((group) => group.id), [groupedRecords]);
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

  const removeRecord = (recordId: string) => {
    setRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));
    setUnqualifiedReasons((currentReasons) => {
      const { [recordId]: _removedReason, ...remainingReasons } = currentReasons;
      return remainingReasons;
    });
    setQualificationNotes((currentNotes) => {
      const { [recordId]: _removedNote, ...remainingNotes } = currentNotes;
      return remainingNotes;
    });
    setAcceptStatuses((currentStatuses) => {
      const { [recordId]: _removedStatus, ...remainingStatuses } = currentStatuses;
      return remainingStatuses;
    });
  };

  const handleAccept = async (
    recordId: string,
    acceptedStatus: UsedGearPendingReviewAcceptedStatus,
    note: string,
  ) => {
    setActionTargetId(recordId);
    setError(null);

    try {
      await acceptPendingReviewRecord(recordId, currentUserName, {
        acceptedStatus,
        qualificationNotes: note,
      });
      removeRecord(recordId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept the selected intake row.');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleUnqualify = async (recordId: string) => {
    setActionTargetId(recordId);
    setError(null);

    try {
      await markPendingReviewUnqualified(recordId, unqualifiedReasons[recordId] ?? '');
      removeRecord(recordId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to mark the selected intake row as unqualified.');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleGroupAccept = async (
    groupId: string,
    recordIds: string[],
    acceptedStatus: UsedGearPendingReviewAcceptedStatus,
    note: string,
    submissionGroupId?: string,
  ) => {
    setActionTargetId(`group:${groupId}`);
    setError(null);

    try {
      await acceptPendingReviewGroup({
        submissionGroupId,
        allocationMode: 'Equal Split',
        records: recordIds.map((currentRecordId) => ({
          recordId: currentRecordId,
          acceptedStatus,
          qualificationNotes: note,
        })),
      }, currentUserName);
      setRecords((currentRecords) => currentRecords.filter((record) => !recordIds.includes(record.id)));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept the selected intake group.');
    } finally {
      setActionTargetId(null);
    }
  };

  const handleGroupUnqualify = async (groupId: string, recordIds: string[], reason: string) => {
    setActionTargetId(`group:${groupId}`);
    setError(null);

    try {
      await markPendingReviewGroupUnqualified(recordIds, reason);
      setRecords((currentRecords) => currentRecords.filter((record) => !recordIds.includes(record.id)));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to mark the selected intake group as unqualified.');
    } finally {
      setActionTargetId(null);
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

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading pending review queue...
          </div>
        ) : groupedRecords.map((group) => {
          const collapsed = collapsedGroupIdSet.has(group.id);
          const groupNeedsSubmissionId = group.records.length > 1
            && group.records.some((record) => stringFieldValue(record, 'Submission Group ID').trim().length === 0);
          const groupHasPricingPath = group.records.every((record) => hasUsedGearPendingReviewPricingPath(record.fields));
          const batchQualificationNote = groupQualificationNotes[group.id] ?? '';
          const batchAcceptStatus = groupAcceptStatuses[group.id] ?? 'Accepted - Awaiting Arrival';
          const batchUnqualifiedReason = groupUnqualifiedReasons[group.id] ?? '';
          const groupBusy = actionTargetId === `group:${group.id}`;
          const batchAcceptRouteDescription = ACCEPT_ROUTE_OPTIONS.find((option) => option.value === batchAcceptStatus)?.description;
          const submissionGroupId = group.key.startsWith('submission:') ? group.label : undefined;

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
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Batch Action</p>
                      <h5 className="mt-1 text-base font-semibold text-[var(--ink)]">Apply the same intake decision to the full group</h5>
                      <p className="mt-1 text-sm text-[var(--muted)]">Use this when every row in the submission should route the same way or move to trash together.</p>
                    </div>
                    <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {groupHasPricingPath ? 'Pricing path ready' : 'Pricing path missing'}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(220px,auto)]">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Group Lot 2 Route</span>
                      <select
                        className={inputClassName}
                        value={batchAcceptStatus}
                        onChange={(event) => setGroupAcceptStatuses((currentStatuses) => ({
                          ...currentStatuses,
                          [group.id]: event.currentTarget.value as UsedGearPendingReviewAcceptedStatus,
                        }))}
                      >
                        {ACCEPT_ROUTE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {batchAcceptRouteDescription ? <p className="mt-1 text-xs text-[var(--muted)]/80">{batchAcceptRouteDescription}</p> : null}
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Shared Qualification Notes</span>
                      <textarea
                        className={inputClassName}
                        rows={3}
                        value={batchQualificationNote}
                        onChange={(event) => setGroupQualificationNotes((currentNotes) => ({
                          ...currentNotes,
                          [group.id]: event.currentTarget.value,
                        }))}
                        placeholder="Applied to each row in this group"
                      />
                    </label>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          void handleGroupAccept(group.id, group.records.map((record) => record.id), batchAcceptStatus, batchQualificationNote, submissionGroupId);
                        }}
                        disabled={groupBusy || batchQualificationNote.trim().length === 0 || !groupHasPricingPath || groupNeedsSubmissionId}
                      >
                        {groupBusy ? 'Saving...' : 'Accept Entire Group'}
                      </button>
                      <input
                        type="text"
                        className={inputClassName}
                        value={batchUnqualifiedReason}
                        onChange={(event) => setGroupUnqualifiedReasons((currentReasons) => ({
                          ...currentReasons,
                          [group.id]: event.currentTarget.value,
                        }))}
                        placeholder="Reason before trashing the full group"
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          void handleGroupUnqualify(group.id, group.records.map((record) => record.id), batchUnqualifiedReason);
                        }}
                        disabled={groupBusy || batchUnqualifiedReason.trim().length === 0}
                      >
                        {groupBusy ? 'Saving...' : 'Trash Entire Group'}
                      </button>
                    </div>
                  </div>

                  {groupNeedsSubmissionId ? (
                    <p className="mt-3 text-sm text-amber-300">This grouped intake still needs a shared Submission Group ID before it can be batch accepted.</p>
                  ) : null}
                  {!groupHasPricingPath ? (
                    <p className="mt-2 text-sm text-amber-300">Every row in the group needs offer, paid amount, or confirmed group total data before batch Lot 2 routing.</p>
                  ) : null}
                </div>
              ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const reason = unqualifiedReasons[record.id] ?? '';
                const qualificationNote = Object.prototype.hasOwnProperty.call(qualificationNotes, record.id)
                  ? qualificationNotes[record.id] ?? ''
                  : stringFieldValue(record, 'Qualification Notes');
                const acceptStatus = acceptStatuses[record.id] ?? 'Accepted - Awaiting Arrival';
                const busy = actionTargetId === record.id;
                const acceptRouteDescription = ACCEPT_ROUTE_OPTIONS.find((option) => option.value === acceptStatus)?.description;
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

                    <div className="mt-3 text-sm text-[var(--muted)]">
                      <div>Qualification Complete: {displayInventoryValue(record.fields['Qualification Complete'])}</div>
                      <div className="mt-1 text-xs text-[var(--muted)]/80">{displayInventoryValue(record.fields['Qualification Notes'])}</div>
                      <div className="mt-2">Offer Amount: {displayInventoryValue(record.fields['Offer Amount'])}</div>
                      <div>Paid Amount: {displayInventoryValue(record.fields['Paid Amount'])}</div>
                      <div>Confirmed Grand Total: {displayInventoryValue(record.fields['Confirmed Grand Total'])}</div>
                      {groupNeedsSubmissionId ? (
                        <div className="mt-2 text-amber-300">Multi-item intake needs a Submission Group ID before acceptance. Open group review to complete the gate.</div>
                      ) : null}
                      {!hasPricingPath ? (
                        <div className="mt-2 text-amber-300">Offer, paid amount, or confirmed group total is still required before Lot 2 routing.</div>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-3">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Lot 2 Route</span>
                        <select
                          className={inputClassName}
                          value={acceptStatus}
                          onChange={(event) => setAcceptStatuses((currentStatuses) => ({
                            ...currentStatuses,
                            [record.id]: event.currentTarget.value as UsedGearPendingReviewAcceptedStatus,
                          }))}
                        >
                          {ACCEPT_ROUTE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        {acceptRouteDescription ? <p className="mt-1 text-xs text-[var(--muted)]/80">{acceptRouteDescription}</p> : null}
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Qualification Notes Required For Lot 2</span>
                        <textarea
                          className={inputClassName}
                          rows={3}
                          value={qualificationNote}
                          onChange={(event) => setQualificationNotes((currentNotes) => ({
                            ...currentNotes,
                            [record.id]: event.currentTarget.value,
                          }))}
                          placeholder="Required before routing accepted intake into Lot 2"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenWorkflowRecord(record.id)}
                      >
                        Workflow Detail
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenIncomingGearForm(record.id)}
                      >
                        Incoming Gear
                      </button>
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          void handleAccept(record.id, acceptStatus, qualificationNote);
                        }}
                        disabled={busy || qualificationNote.trim().length === 0 || !hasPricingPath || groupNeedsSubmissionId}
                      >
                        {busy ? 'Saving...' : 'Accept Into Lot 2'}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <input
                        type="text"
                        className={inputClassName}
                        value={reason}
                        onChange={(event) => setUnqualifiedReasons((currentReasons) => ({
                          ...currentReasons,
                          [record.id]: event.currentTarget.value,
                        }))}
                        placeholder="Required reason before sending to trash"
                      />
                      <button
                        type="button"
                        className="w-full rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          void handleUnqualify(record.id);
                        }}
                        disabled={busy || reason.trim().length === 0}
                      >
                        {busy ? 'Saving...' : 'Mark Unqualified'}
                      </button>
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