import { useEffect, useMemo, useState } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn, type IntakeItemsMatrixGroup } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { getWorkflowStatusChipClasses } from '@/components/app/workflowStatusChips';
import { getParkingLotItemTitle, getParkingLotStatusLabel } from '@/components/tabs/airtable/usedGearParkingLotPresentation';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import { groupUsedGearWorkflowRecords, loadParkingLotQueue, type UsedGearWorkflowGroup } from '@/services/usedGearQueue';
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearParkingLotSectionProps {
  currentUserName: string;
  onOpenGroupReview?: (group: UsedGearWorkflowGroup) => void;
  onOpenReviewRecord: (record: AirtableRecord) => void;
  showSectionIntro?: boolean;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearParkingLotSortMode;
  onSortModeChange?: (value: UsedGearParkingLotSortMode) => void;
}

export type UsedGearParkingLotSortMode = 'group-label' | 'newest' | 'oldest' | 'arrival-date' | 'make-model';

function recordSearchText(record: AirtableRecord): string {
  return [
    record.fields.SKU,
    record.fields.Make,
    record.fields.Model,
    record.fields['Workflow Source'],
    record.fields['Workflow Status'],
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

function getParkingLotSortLabel(sortMode: UsedGearParkingLotSortMode): string {
  if (sortMode === 'newest') return 'Newest First';
  if (sortMode === 'oldest') return 'Oldest First';
  if (sortMode === 'arrival-date') return 'Arrival Date';
  if (sortMode === 'make-model') return 'Make Then Model';
  return 'Default Order';
}

function renderWorkflowSource(value: unknown) {
  const sourceLabel = displayInventoryValue(value);
  if (!sourceLabel) {
    return <span className="text-xs text-[var(--muted)]/60">-</span>;
  }

  return (
    <span className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
      {sourceLabel}
    </span>
  );
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

export function UsedGearParkingLotSection({
  onOpenGroupReview,
  onOpenReviewRecord,
  showSectionIntro = true,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearParkingLotSectionProps) {
  const [records, setRecords] = useState<AirtableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncontrolledSearchTerm, setUncontrolledSearchTerm] = useState('');
  const [uncontrolledSortMode, setUncontrolledSortMode] = useState<UsedGearParkingLotSortMode>('group-label');
  const searchTerm = typeof controlledSearchTerm === 'string' ? controlledSearchTerm : uncontrolledSearchTerm;
  const sortMode = controlledSortMode ?? uncontrolledSortMode;

  useEffect(() => {
    let cancelled = false;

    const loadQueue = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextRecords = await loadParkingLotQueue();
        if (!cancelled) {
          setRecords(nextRecords);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the Parking Lot queue.');
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

  const matrixGroups = useMemo<IntakeItemsMatrixGroup<AirtableRecord>[]>(() => groupedRecords.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: group.records,
  })), [groupedRecords]);

  const refreshQueue = async () => {
    setRefreshing(true);
    setError(null);

    try {
      setRecords(await loadParkingLotQueue());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the Parking Lot queue.');
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

  const handleSortModeChange = (value: UsedGearParkingLotSortMode) => {
    if (!controlledSortMode) {
      setUncontrolledSortMode(value);
    }

    onSortModeChange?.(value);
  };

  return (
    <AppPageSectionSurface id="used-gear-parking-lot" className="space-y-5">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <AppSectionTitle title="Parking Lot" />
        ) : null}
        <QueueSearchToolbar
          searchAriaLabel="Search Parking Lot"
          searchPlaceholder="Search by SKU, make, model, source, or status"
          searchValue={searchTerm}
          onSearchChange={handleSearchTermChange}
          refreshLabel="Refresh Parking Lot queue"
          refreshLoadingLabel="Refreshing Parking Lot queue"
          refreshing={refreshing}
          onRefresh={() => {
            void refreshQueue();
          }}
          sortAriaLabel={`Sort Parking Lot queue. Current order: ${getParkingLotSortLabel(sortMode)}`}
          sortValue={sortMode}
          onSortChange={(value) => handleSortModeChange(value as UsedGearParkingLotSortMode)}
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
        <EmptySurface title="Parking Lot is clear" message="No used-gear operational rows are currently waiting in the Parking Lot.">
          <p className="mt-3 text-sm text-[var(--muted)]">
            Next route: check Manual Intake for new in-app deals, or open Trash Review when a rejected intake needs to be restored.
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading Parking Lot queue...
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
              width: 'minmax(0,1.6fr)',
              renderCell: (record) => (
                <div className="min-w-0">
                  <div className="truncate text-sm text-[var(--ink)]">{getParkingLotItemTitle(record)}</div>
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              width: '12rem',
              renderCell: (record) => {
                const statusLabel = getParkingLotStatusLabel(record) || 'Unknown';
                return <span className={getWorkflowStatusChipClasses(statusLabel)}>{statusLabel}</span>;
              },
            },
            {
              key: 'source',
              label: 'Source',
              width: '9rem',
              renderCell: (record) => renderWorkflowSource(record.fields['Workflow Source']),
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
                  <CompactIconActionButton
                    label="Open Review"
                    variant="compact-primary"
                    icon="edit"
                    onClick={() => onOpenReviewRecord(record)}
                  />
                </div>
              ),
            },
          ];

          return (
            <IntakeItemsMatrix
              groups={matrixGroups}
              columns={columns}
              getItemKey={(record) => record.id}
              groupColumnLabel="Group"
              renderGroupCell={(group) => {
                const needsSubmissionId = group.description === 'Submission group'
                  && group.items.some((record) => stringFieldValue(record, 'Submission Group ID').trim().length === 0);

                if (group.items.length === 1) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                return (
                  <div className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.items.length}</span>
                    {needsSubmissionId ? <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-300">ID</span> : null}
                  </div>
                );
              }}
              groupActionColumnLabel="Batch"
              renderGroupActionCell={(group) => {
                if (group.items.length === 1 || !onOpenGroupReview) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                const sourceGroup = groupedRecords.find((candidate) => candidate.id === group.id);
                if (!sourceGroup) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                return (
                  <div className="flex items-center justify-center">
                    <CompactIconActionButton
                      label={group.description === 'Pickup group' ? `Open pickup set ${group.label}` : `Open submission set ${group.label}`}
                      variant="small-secondary"
                      icon="group"
                      onClick={() => onOpenGroupReview(sourceGroup)}
                    />
                  </div>
                );
              }}
            />
          );
        })()}
      </div>
    </AppPageSectionSurface>
  );
}