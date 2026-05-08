import { useEffect, useMemo, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadTrashQueue,
  permanentlyDeleteTrashRecord,
  requalifyTrashRecord,
  restoreTrashRecord,
  type UsedGearPendingReviewAcceptedStatus,
} from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearTrashSectionProps {
  currentUserName: string;
  onOpenWorkflowRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
}

const REQUALIFY_ROUTE_OPTIONS: Array<{ value: UsedGearPendingReviewAcceptedStatus; label: string }> = [
  { value: 'Accepted - Awaiting Arrival', label: 'Re-qualify: Awaiting Arrival' },
  { value: 'Accepted - Arrived, Awaiting SKU', label: 'Re-qualify: Arrived, Awaiting SKU' },
  { value: 'Accepted - Arrived, Awaiting Missing Item', label: 'Re-qualify: Arrived, Awaiting Missing Item' },
];

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Source'],
    record.fields['Submission Group ID'],
    record.fields['Pick Up ID'],
    record.fields['Unqualified Reason'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

export function UsedGearTrashSection({
  currentUserName,
  onOpenWorkflowRecord,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
}: UsedGearTrashSectionProps) {
  const { copyingLink, copiedLink, copyLink } = useCopyQueueLink({
    sectionId: 'used-gear-trash',
    successTitle: 'Trash link copied',
    successMessage: 'The workflow trash link is ready to share.',
    unavailableMessage: 'This browser cannot copy the workflow trash link automatically.',
    failureMessage: 'The workflow trash link could not be copied. Try again or copy the URL from the browser address bar.',
  });
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [actionRecordId, setActionRecordId] = useState<string | null>(null);
  const [requalifyNotes, setRequalifyNotes] = useState<Record<string, string>>({});
  const [requalifyStatuses, setRequalifyStatuses] = useState<Record<string, UsedGearPendingReviewAcceptedStatus>>({});
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadTrashQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the workflow trash queue.');
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

  const groupedRecords = useMemo(() => groupUsedGearWorkflowRecords(filteredRecords), [filteredRecords]);

  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadTrashQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the workflow trash queue.');
    } finally {
      setRefreshing(false);
    }
  };

  const removeRecord = (recordId: string) => {
    setRecords((currentRecords) => currentRecords.filter((record) => record.id !== recordId));
    setRequalifyNotes((currentNotes) => {
      const { [recordId]: _removed, ...remaining } = currentNotes;
      return remaining;
    });
    setRequalifyStatuses((currentStatuses) => {
      const { [recordId]: _removed, ...remaining } = currentStatuses;
      return remaining;
    });
  };

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const handleRestore = async (recordId: string) => {
    setActionRecordId(recordId);
    setError(null);

    try {
      await restoreTrashRecord(recordId);
      removeRecord(recordId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to restore the selected trash row.');
    } finally {
      setActionRecordId(null);
    }
  };

  const handleRequalify = async (recordId: string) => {
    setActionRecordId(recordId);
    setError(null);

    try {
      await requalifyTrashRecord(recordId, currentUserName, {
        acceptedStatus: requalifyStatuses[recordId] ?? 'Accepted - Awaiting Arrival',
        qualificationNotes: requalifyNotes[recordId] ?? '',
      });
      removeRecord(recordId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to re-qualify the selected trash row into Lot 2.');
    } finally {
      setActionRecordId(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    setActionRecordId(recordId);
    setError(null);

    try {
      await permanentlyDeleteTrashRecord(recordId);
      removeRecord(recordId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to permanently delete the selected trash row.');
    } finally {
      setActionRecordId(null);
    }
  };

  return (
    <section id="used-gear-trash" className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Used Gear Workflow</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Trash Review</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Review rows that were marked unqualified and routed into active trash. Restore, re-qualify, and permanent-delete actions are available here so intake can recover mistakes without leaving Parking Lot 1.
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
            {copyingLink ? 'Copying...' : copiedLink ? 'Link Copied' : 'Copy Trash Link'}
          </button>
          <label className="min-w-[240px] flex-1">
            <span className="sr-only">Search workflow trash</span>
            <input
              type="text"
              className={inputClassName}
              value={searchTerm}
              onChange={(event) => handleSearchTermChange(event.currentTarget.value)}
              placeholder="Search by SKU, make, model, reason, or group id"
            />
          </label>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void refreshQueue();
            }}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Trash'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-4">
          <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Trash Rows</p>
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
      </div>

      {!loading && records.length === 0 ? (
        <EmptySurface title="Trash queue is clear" message="No used-gear workflow rows are currently sitting in active trash.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: return to pending review when an intake needs re-qualification, or leave this queue alone when there is nothing to restore or delete.
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading workflow trash...
          </div>
        ) : groupedRecords.map((group) => (
          <div key={group.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.description}</p>
                <h4 className="mt-1 text-lg font-semibold text-[var(--ink)]">{group.label}</h4>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {group.records.length} row{group.records.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {group.records.map((record) => {
                const requalifyNote = requalifyNotes[record.id] ?? '';
                const requalifyStatus = requalifyStatuses[record.id] ?? 'Accepted - Awaiting Arrival';
                const busy = actionRecordId === record.id;
                const hasPricingPath = hasUsedGearPendingReviewPricingPath(record.fields);

                return (
                <article key={record.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{displayInventoryValue(record.fields['Workflow Source'])}</p>
                      <h5 className="mt-1 text-lg font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</h5>
                      <p className="mt-1 text-sm text-[var(--muted)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</p>
                    </div>
                    <div className="rounded-full border border-rose-400/35 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-rose-200">
                      {displayInventoryValue(record.fields['Workflow Status'])}
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Reason:</span> {displayInventoryValue(record.fields['Unqualified Reason'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Qualification Notes:</span> {displayInventoryValue(record.fields['Qualification Notes'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Offer Amount:</span> {displayInventoryValue(record.fields['Offer Amount'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Paid Amount:</span> {displayInventoryValue(record.fields['Paid Amount'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Trash Status:</span> {displayInventoryValue(record.fields['Trash Status'])}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Re-qualify Route</span>
                      <select
                        className={inputClassName}
                        value={requalifyStatus}
                        onChange={(event) => setRequalifyStatuses((currentStatuses) => ({
                          ...currentStatuses,
                          [record.id]: event.currentTarget.value as UsedGearPendingReviewAcceptedStatus,
                        }))}
                      >
                        {REQUALIFY_ROUTE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Re-qualify Notes</span>
                      <textarea
                        className={inputClassName}
                        rows={3}
                        value={requalifyNote}
                        onChange={(event) => setRequalifyNotes((currentNotes) => ({
                          ...currentNotes,
                          [record.id]: event.currentTarget.value,
                        }))}
                        placeholder="Required before sending the item back into Lot 2"
                      />
                    </label>
                    {!hasPricingPath ? (
                      <p className="m-0 text-xs text-amber-300">Offer, paid amount, or confirmed group total is still required before re-qualifying this row into Lot 2.</p>
                    ) : null}
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
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleRestore(record.id);
                      }}
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Restore To Lot 1'}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleRequalify(record.id);
                      }}
                      disabled={busy || requalifyNote.trim().length === 0 || !hasPricingPath}
                    >
                      {busy ? 'Saving...' : 'Re-qualify Into Lot 2'}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => {
                        void handleDelete(record.id);
                      }}
                      disabled={busy}
                    >
                      {busy ? 'Saving...' : 'Delete Permanently'}
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}