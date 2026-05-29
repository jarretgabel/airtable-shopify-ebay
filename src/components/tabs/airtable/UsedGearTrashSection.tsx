import { useEffect, useMemo, useState } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn, type IntakeItemsMatrixGroup } from '@/components/app/IntakeItemsMatrix';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  groupUsedGearWorkflowRecords,
  loadTrashQueue,
} from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

interface UsedGearTrashSectionProps {
  onOpenReviewRecord: (recordId: string) => void;
  onOpenGroupReview: (groupId: string) => void;
  showSectionIntro?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearTrashSortMode;
  onSortModeChange?: (value: UsedGearTrashSortMode) => void;
}

export type UsedGearTrashSortMode = 'group-label' | 'newest' | 'oldest' | 'arrival-date' | 'make-model';

function shouldShowTrashStatusTag(statusLabel: string): boolean {
  return statusLabel.trim().toLowerCase() !== 'unqualified';
}

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Source'],
    record.fields['Workflow Status'],
    record.fields['Unqualified Reason'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
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

function getTrashSortLabel(sortMode: UsedGearTrashSortMode): string {
  if (sortMode === 'newest') return 'Newest First';
  if (sortMode === 'oldest') return 'Oldest First';
  if (sortMode === 'arrival-date') return 'Arrival Date';
  if (sortMode === 'make-model') return 'Make Then Model';
  return 'Default Order';
}

export function UsedGearTrashSection({
  onOpenReviewRecord,
  onOpenGroupReview,
  showSectionIntro = true,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearTrashSectionProps) {
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearTrashSortMode>('group-label');
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

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

  const handleSearchTermChange = (value: string) => {
    if (typeof controlledSearchTerm !== 'string') {
      setUncontrolledSearchTerm(value);
    }

    onSearchTermChange?.(value);
  };

  const handleSortModeChange = (value: UsedGearTrashSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [groupedRecords]);

  return (
    <AppPageSectionSurface id="used-gear-trash" className="space-y-5">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <AppSectionTitle title="Trash" />
        ) : null}
        <QueueSearchToolbar
          searchAriaLabel="Search workflow trash"
          searchPlaceholder="Search by SKU, make, model, source, status, or reason"
          searchValue={searchTerm}
          onSearchChange={handleSearchTermChange}
          refreshLabel="Refresh trash review queue"
          refreshLoadingLabel="Refreshing trash review queue"
          refreshing={refreshing}
          onRefresh={() => {
            void refreshQueue();
          }}
          sortAriaLabel={`Sort trash review queue. Current order: ${getTrashSortLabel(sortMode)}`}
          sortValue={sortMode}
          onSortChange={(value) => handleSortModeChange(value as UsedGearTrashSortMode)}
          sortOptions={[
            { value: 'group-label', label: 'Default Order' },
            { value: 'newest', label: 'Newest First' },
            { value: 'oldest', label: 'Oldest First' },
            { value: 'arrival-date', label: 'Arrival Date' },
            { value: 'make-model', label: 'Make Then Model' },
          ]}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && records.length === 0 ? (
        <EmptySurface title="Trash queue is clear" message="No used-gear operational rows are currently sitting in active trash.">
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
        ) : (() => {
          const columns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
            {
              key: 'sku',
              label: 'SKU',
              width: '10rem',
              renderCell: (record) => <span className="font-semibold text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</span>,
            },
            {
              key: 'item',
              label: 'Item',
              width: 'minmax(0,1.4fr)',
              renderCell: (record) => (
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                    <span>{displayInventoryValue(record.fields['Workflow Source'])}</span>
                    {shouldShowTrashStatusTag(displayInventoryValue(record.fields['Workflow Status'])) ? <span>{displayInventoryValue(record.fields['Workflow Status'])}</span> : null}
                  </div>
                </div>
              ),
            },
            {
              key: 'reason',
              label: 'Reason',
              width: 'minmax(0,1.4fr)',
              renderCell: (record) => <span className="text-xs text-[var(--muted)]">{displayInventoryValue(record.fields['Unqualified Reason'])}</span>,
            },
            {
              key: 'intake',
              label: 'Intake',
              width: '8rem',
              renderCell: (record) => <span className="text-xs text-[var(--muted)]">{formatIntakeDate(record)}</span>,
            },
            {
              key: 'actions',
              label: 'Item Actions',
              width: '4.75rem',
              align: 'center',
              headerClassName: 'border-l border-[var(--line)]/60',
              cellClassName: 'border-l border-[var(--line)]/60',
              renderCell: (record) => (
                <div className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5">
                  <CompactIconActionButton label="Open Review" variant="compact-primary" icon="edit" onClick={() => onOpenReviewRecord(record.id)} />
                </div>
              ),
            },
          ];

          const allGroups: IntakeItemsMatrixGroup<AirtableRecord>[] = groupedRecords.map((group) => ({
            id: group.id,
            label: group.label,
            description: group.description,
            items: group.records,
          }));
          const pagedGroups = allGroups.slice((page - 1) * 30, page * 30);

          return (
            <IntakeItemsMatrix
              groups={pagedGroups}
              columns={columns}
              getItemKey={(record) => record.id}
              groupColumnLabel="Group"
              renderGroupCell={(group) => {
                if (group.items.length === 1) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                return (
                  <div className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.items.length}</span>
                  </div>
                );
              }}
              renderGroupActionCell={(group) => {
                if (group.items.length === 1) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                return (
                  <div className="flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-1.5">
                    <CompactIconActionButton
                      label="Open Group Review"
                      variant="compact-primary"
                      icon="edit"
                      onClick={() => onOpenGroupReview(group.id)}
                    />
                  </div>
                );
              }}
            />
          );
        })()}
        {!loading && (() => {
          const allGroupCount = groupedRecords.length;
          const totalGroupPages = Math.ceil(allGroupCount / 30);
          return totalGroupPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">
                Showing {Math.min(page * 30, allGroupCount) - (page - 1) * 30} of {allGroupCount} groups
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--line)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="min-w-[6rem] text-center text-sm text-[var(--muted)]">
                  Page {page} of {totalGroupPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalGroupPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--line)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          ) : null;
        })()}
      </div>
    </AppPageSectionSurface>
  );
}