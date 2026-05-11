import { useEffect, useMemo, useState } from 'react';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { useCopyQueueLink } from '@/components/tabs/airtable/useCopyQueueLink';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  groupUsedGearWorkflowRecords,
  hasUsedGearPendingReviewPricingPath,
  loadTrashQueue,
} from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearTrashSectionProps {
  onOpenReviewRecord: (recordId: string) => void;
  onOpenWorkflowRecord: (recordId: string) => void;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
}

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

function previewText(value: unknown): string {
  const normalized = displayInventoryValue(value);
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

export function UsedGearTrashSection({
  onOpenReviewRecord,
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

  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
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

                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Reason:</span> {displayInventoryValue(record.fields['Unqualified Reason'])}
                    </div>
                    <div>
                      <span className="font-semibold text-[var(--ink)]">Pricing Gate:</span> {hasPricingPath ? 'Ready' : 'Missing'}
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
                      <span className="font-semibold text-[var(--ink)]">Trash Status:</span> {displayInventoryValue(record.fields['Trash Status'])}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="font-semibold text-[var(--ink)]">Internal Notes:</span> {previewText(record.fields['Internal Functional Notes'] || record.fields['Internal Cosmetic Notes'] || record.fields['Internal Inclusion Notes'])}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
                      onClick={() => onOpenReviewRecord(record.id)}
                    >
                      Open Review
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
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
        ))}
      </div>
    </section>
  );
}