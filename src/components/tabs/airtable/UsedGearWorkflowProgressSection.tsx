import { useEffect, useMemo, useState } from 'react';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { AppSectionTitle } from '@/components/app/AppSectionTitle';
import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn, type IntakeItemsMatrixGroup } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { EmptySurface } from '@/components/app/StateSurfaces';
import { getWorkflowStatusChipClasses } from '@/components/app/workflowStatusChips';
import { displayInventoryValue } from '@/services/inventoryDirectory';
import {
  groupUsedGearWorkflowRecords,
  loadWorkflowProgressQueue,
} from '@/services/usedGearQueue';
import { getUsedGearWorkflowStatus } from '@/services/usedGearWorkflow';
import type { AirtableRecord } from '@/types/airtable';

export interface UsedGearWorkflowProgressSectionProps {
  currentUserName: string;
  onOpenManualIntake: (recordId: string) => void;
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onOpenOperationalRecord: (recordId: string) => void;
  onOpenListingsRecord: (recordId: string) => void;
  showSectionIntro?: boolean;
  queueMode?: UsedGearWorkflowProgressQueueMode;
  sectionId?: string;
  focusedGroupId?: string | null;
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  sortMode?: UsedGearWorkflowProgressSortMode;
  onSortModeChange?: (value: UsedGearWorkflowProgressSortMode) => void;
}

export type UsedGearWorkflowProgressSortMode = 'group-label' | 'newest' | 'oldest';
export type UsedGearWorkflowProgressQueueMode = 'all' | 'testing' | 'photography';

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
    record.fields['Pick Up ID'],
  ]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function isTestingQueueStatus(record: AirtableRecord): boolean {
  const status = getUsedGearWorkflowStatus(record.fields);
  return status === 'Testing In Progress';
}

function isPhotographyQueueStatus(record: AirtableRecord): boolean {
  const status = getUsedGearWorkflowStatus(record.fields);
  return status === 'Photography In Progress';
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

function stripQueueTitleSuffixes(title: string): string {
  return title
    .replace(/\s+(testing pending|photo pending|photography pending|awaiting sku|awaiting arrival)$/i, '')
    .trim();
}

function getPrimaryQueueAction(
  queueMode: UsedGearWorkflowProgressQueueMode,
  record: AirtableRecord,
  handlers: Pick<
    UsedGearWorkflowProgressSectionProps,
    'onOpenManualIntake' | 'onOpenTestingForm' | 'onOpenPhotosForm' | 'onOpenOperationalRecord' | 'onOpenListingsRecord'
  >,
): { label: string; onClick: () => void; showSecondaryAction: boolean; icon: 'open' | 'form' | 'edit' } {
  const status = getUsedGearWorkflowStatus(record.fields) ?? 'Unknown';

  if (queueMode === 'testing' && isTestingQueueStatus(record)) {
    return {
      label: 'Open Testing',
      onClick: () => handlers.onOpenTestingForm(record.id),
      showSecondaryAction: false,
      icon: 'edit',
    };
  }

  if (queueMode === 'photography' && isPhotographyQueueStatus(record)) {
    return {
      label: 'Open Photos',
      onClick: () => handlers.onOpenPhotosForm(record.id),
      showSecondaryAction: false,
      icon: 'edit',
    };
  }

  if (
    status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item'
  ) {
    return {
      label: 'Open Intake',
      onClick: () => handlers.onOpenManualIntake(record.id),
      showSecondaryAction: true,
      icon: 'edit',
    };
  }

  if (status === 'Testing In Progress') {
    return {
      label: 'Open Testing',
      onClick: () => handlers.onOpenTestingForm(record.id),
      showSecondaryAction: true,
      icon: 'edit',
    };
  }

  if (status === 'Photography In Progress') {
    return {
      label: 'Open Photos',
      onClick: () => handlers.onOpenPhotosForm(record.id),
      showSecondaryAction: true,
      icon: 'edit',
    };
  }

  if (status === 'Awaiting Pre-Listing Review') {
    return {
      label: 'Open Listings Approval',
      onClick: () => handlers.onOpenListingsRecord(record.id),
      showSecondaryAction: true,
      icon: 'edit',
    };
  }

  return {
    label: 'Edit Workflow Record',
    onClick: () => handlers.onOpenOperationalRecord(record.id),
    showSecondaryAction: false,
    icon: 'edit',
  };
}

function getQueueItemTitle(record: AirtableRecord): string {
  const make = displayInventoryValue(record.fields.Make);
  const model = displayInventoryValue(record.fields.Model);
  const rawTitle = [make, model].filter(Boolean).join(' · ');

  return stripQueueTitleSuffixes(rawTitle);
}

function getQueuePresentation(queueMode: UsedGearWorkflowProgressQueueMode): ProgressQueuePresentation {
  if (queueMode === 'testing') {
    return {
      eyebrow: 'Used Gear Workflow',
      title: 'Testing Queue',
      description: 'Focus only on rows still waiting for testing signoff. Related rows stay grouped by pickup or submission so multi-item work stays coherent before photography begins.',
      emptyTitle: 'No rows currently need testing',
      emptyMessage: 'The testing queue is clear. Rows that still need testing will appear here automatically.',
      emptyGuidance: 'Next route: move accepted rows through Parking Lot and complete arrival-stage handling so testing work can begin.',
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
      description: 'Focus only on rows that already cleared testing and are now waiting for photography signoff. Related rows stay grouped by pickup or submission so staging work can be handed off cleanly.',
      emptyTitle: 'No rows currently need photography',
      emptyMessage: 'The photography queue is clear. Rows that still need photography will appear here automatically.',
      emptyGuidance: 'Next route: use Parking Lot or the testing queue until rows are ready for photo-stage completion.',
      copySuccessTitle: 'Photography queue link copied',
      copySuccessMessage: 'The photography queue link is ready to share.',
      copyUnavailableMessage: 'This browser cannot copy the photography queue link automatically.',
      copyFailureMessage: 'The photography queue link could not be copied. Try again or copy the URL from the browser address bar.',
      sharedFocusMessage: 'Shared link opened the photography queue focused on one grouped submission.',
    };
  }

  return {
    eyebrow: 'Used Gear Workflow',
    title: 'Processing And Specialist Queue',
    description: 'Manage accepted intake rows through arrival handling, processing, testing, and photography. Related rows stay grouped by pickup or submission.',
    emptyTitle: 'No active operational rows in processing or holding',
    emptyMessage: 'The used-gear queue currently has no accepted rows still moving through arrival, processing, testing, or photography.',
    emptyGuidance: 'Next route: review Parking Lot for newly accepted arrivals, or open Listings for rows that have already reached listing-phase review.',
    copySuccessTitle: 'Queue link copied',
    copySuccessMessage: 'The processing and specialist queue link is ready to share.',
    copyUnavailableMessage: 'This browser cannot copy the processing and specialist queue link automatically.',
    copyFailureMessage: 'The processing and specialist queue link could not be copied. Try again or copy the URL from the browser address bar.',
    sharedFocusMessage: 'Shared link opened the processing and specialist queue focused on one grouped submission.',
  };
}

export function UsedGearWorkflowProgressSection({
  showSectionIntro = true,
  onOpenManualIntake,
  onOpenTestingForm,
  onOpenPhotosForm,
  onOpenOperationalRecord,
  onOpenListingsRecord,
  queueMode = 'all',
  sectionId = 'used-gear-progress-queue',
  focusedGroupId = null,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  sortMode: controlledSortMode,
  onSortModeChange,
}: UsedGearWorkflowProgressSectionProps) {
  const queuePresentation = getQueuePresentation(queueMode);
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
      return records.filter((record) => isTestingQueueStatus(record));
    }

    if (queueMode === 'photography') {
      return records.filter((record) => isPhotographyQueueStatus(record));
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

  const visibleGroups = useMemo(() => {
    if (!focusedGroupId) {
      return groupedRecords;
    }

    return groupedRecords.filter((group) => group.id === focusedGroupId);
  }, [focusedGroupId, groupedRecords]);

  const matrixGroups = useMemo<IntakeItemsMatrixGroup<AirtableRecord>[]>(() => visibleGroups.map((group) => ({
    id: group.id,
    label: group.label,
    description: group.description,
    items: group.records,
  })), [visibleGroups]);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [matrixGroups]);
  const totalGroupPages = Math.ceil(matrixGroups.length / 30);
  const pagedGroups = matrixGroups.slice((page - 1) * 30, page * 30);
  const pagedGroupRecordCount = pagedGroups.reduce((sum, g) => sum + g.items.length, 0);
  const shouldShowGroupColumn = queueMode === 'all';

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
    <AppPageSectionSurface id={sectionId} className="space-y-4">
      <div className="flex flex-col gap-4">
        {showSectionIntro ? (
          <AppSectionTitle title={queuePresentation.title} />
        ) : null}
        <QueueSearchToolbar
          searchAriaLabel="Search used gear progress queue"
          searchPlaceholder="Search by status, SKU, model, group, or next team"
          searchValue={searchTerm}
          onSearchChange={handleSearchTermChange}
          refreshLabel="Refresh workflow processing and holding queue"
          refreshLoadingLabel="Refreshing workflow processing and holding queue"
          refreshing={refreshing}
          onRefresh={() => {
            void refreshQueue();
          }}
          sortAriaLabel={`Sort used gear processing and holding queue. Current order: ${getWorkflowProgressSortLabel(sortMode)}`}
          sortValue={sortMode}
          onSortChange={(value) => handleSortModeChange(value as UsedGearWorkflowProgressSortMode)}
          sortOptions={[
            { value: 'group-label', label: 'Default Order' },
            { value: 'newest', label: 'Newest First' },
            { value: 'oldest', label: 'Oldest First' },
          ]}
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {!loading && groupedRecords.length === 0 ? (
        <EmptySurface title={queuePresentation.emptyTitle} message={queuePresentation.emptyMessage}>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {queuePresentation.emptyGuidance}
          </p>
        </EmptySurface>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-sm text-[var(--muted)]">
            Loading used-gear processing and holding queue...
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
              width: 'minmax(0,1.5fr)',
              renderCell: (record) => <div className="min-w-0 truncate text-sm text-[var(--ink)]">{getQueueItemTitle(record)}</div>,
            },
            {
              key: 'actions',
              label: 'Item Actions',
              width: '6rem',
              align: 'center',
              headerClassName: 'border-l border-[var(--line)]/60',
              cellClassName: 'border-l border-[var(--line)]/60',
              renderCell: (record) => {
                const primaryAction = getPrimaryQueueAction(queueMode, record, {
                  onOpenManualIntake,
                  onOpenTestingForm,
                  onOpenPhotosForm,
                  onOpenOperationalRecord,
                  onOpenListingsRecord,
                });

                return (
                  <div className="flex min-h-[4.5rem] w-full items-center justify-center gap-1.5">
                    <CompactIconActionButton label={primaryAction.label} variant="compact-primary" icon={primaryAction.icon} onClick={primaryAction.onClick} />
                    {primaryAction.showSecondaryAction ? (
                      <CompactIconActionButton label="Edit Workflow Record" icon="edit" onClick={() => onOpenOperationalRecord(record.id)} />
                    ) : null}
                  </div>
                );
              },
            },
          ];

          if (queueMode === 'all') {
            columns.splice(2, 0,
              {
                key: 'status',
                label: 'Status',
                width: '18rem',
                renderCell: (record) => {
                  const statusLabel = getUsedGearWorkflowStatus(record.fields) ?? 'Unknown';

                  return <span className={getWorkflowStatusChipClasses(statusLabel)}>{statusLabel}</span>;
                },
              },
              {
                key: 'intake',
                label: 'Intake',
                width: '8rem',
                renderCell: (record) => <span className="text-xs text-[var(--muted)]">{formatIntakeDate(record)}</span>,
              },
            );
          } else {
            columns.splice(2, 0,
              {
                key: 'intake',
                label: 'Intake',
                width: '8rem',
                renderCell: (record) => <span className="text-xs text-[var(--muted)]">{formatIntakeDate(record)}</span>,
              },
            );
          }

          if (!matrixGroups.length) {
            return (
              <EmptySurface
                title="Focused progress group not found"
                message="The shared Inventory link opened a progress group that is no longer visible in this queue."
              />
            );
          }

          return (
            <IntakeItemsMatrix
              groups={pagedGroups}
              columns={columns}
              getItemKey={(record) => record.id}
              groupColumnLabel={shouldShowGroupColumn ? 'Group' : undefined}
              renderGroupCell={shouldShowGroupColumn ? ((group) => {
                if (group.items.length === 1) {
                  return <span className="text-xs text-[var(--muted)]/45">-</span>;
                }

                return (
                  <div className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{group.items.length}</span>
                  </div>
                );
              }) : undefined}
            />
          );
        })()}
        {!loading && totalGroupPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              Showing {pagedGroupRecordCount} of {filteredRecords.length}
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
        ) : null}
      </div>
    </AppPageSectionSurface>
  );
}