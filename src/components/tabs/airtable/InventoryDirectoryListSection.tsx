import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import { getWorkflowStatusChipClasses } from '@/components/app/workflowStatusChips';
import type { AirtableRecord } from '@/types/airtable';
import {
  displayInventoryValue,
  getInventoryDirectoryItemLabel,
  getInventoryDirectorySku,
  getInventoryDirectoryStatus,
} from '@/services/inventoryDirectory';

interface InventoryDirectoryListSectionProps {
  records: AirtableRecord[];
  totalCount: number;
  searchTerm: string;
  statusFilter: string;
  sortMode: 'intake-newest' | 'intake-oldest';
  statusOptions: string[];
  refreshing?: boolean;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSortModeChange: (value: 'intake-newest' | 'intake-oldest') => void;
  onRefresh?: () => void;
  onSelectRecord: (recordId: string) => void;
  getNextStepLabel?: (record: AirtableRecord) => string | null;
  onOpenNextStep?: (record: AirtableRecord) => void;
  getSecondaryActionLabel?: (record: AirtableRecord) => string | null;
  onOpenSecondaryAction?: (record: AirtableRecord) => void;
  secondaryActionIcon?: 'open' | 'group' | 'check' | 'truck' | 'form' | 'edit';
  selectRecordLabel?: string;
  searchAriaLabel?: string;
  searchPlaceholder?: string;
  refreshLabel?: string;
  refreshLoadingLabel?: string;
  resultLabel?: string;
  emptyMessage?: string;
  getItemLabel?: (record: AirtableRecord) => string;
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

function getDirectorySortLabel(sortMode: 'intake-newest' | 'intake-oldest'): string {
  if (sortMode === 'intake-oldest') return 'Intake Date: Oldest First';
  return 'Intake Date: Newest First';
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

export function InventoryDirectoryListSection({
  records,
  totalCount,
  searchTerm,
  statusFilter,
  sortMode,
  statusOptions,
  refreshing = false,
  onSearchTermChange,
  onStatusFilterChange,
  onSortModeChange,
  onRefresh,
  onSelectRecord,
  getNextStepLabel,
  onOpenNextStep,
  getSecondaryActionLabel,
  onOpenSecondaryAction,
  secondaryActionIcon = 'edit',
  selectRecordLabel = 'Open Workflow Snapshot',
  searchAriaLabel = 'Search inventory',
  searchPlaceholder = 'Search by SKU, make, model, source, or status',
  refreshLabel = 'Refresh Workflow Hub directory',
  refreshLoadingLabel = 'Refreshing Workflow Hub directory',
  resultLabel = 'workflow rows',
  emptyMessage = 'No workflow rows match the current search and status filters.',
  getItemLabel = (record) => getInventoryDirectoryItemLabel(record.fields),
}: InventoryDirectoryListSectionProps) {
  const columns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
    {
      key: 'sku',
      label: 'SKU',
      width: '9rem',
      renderCell: (record) => <span className="font-medium text-[var(--ink)]">{displayInventoryValue(getInventoryDirectorySku(record.fields))}</span>,
    },
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(0,1.55fr)',
      renderCell: (record) => <div className="min-w-0 truncate text-sm text-[var(--ink)]">{displayInventoryValue(getItemLabel(record))}</div>,
    },
    {
      key: 'source',
      label: 'Source',
      width: '9rem',
      renderCell: (record) => renderWorkflowSource(record.fields['Workflow Source']),
    },
    {
      key: 'status',
      label: 'Status',
      width: '14rem',
      renderCell: (record) => {
        const statusLabel = displayInventoryValue(getInventoryDirectoryStatus(record.fields)) || 'Unknown';

        return (
          <div className="min-w-0">
            <span className={`${getWorkflowStatusChipClasses(statusLabel)} overflow-hidden text-ellipsis`} title={statusLabel}>
              {statusLabel}
            </span>
          </div>
        );
      },
    },
    {
      key: 'intake',
      label: 'Intake',
      width: '8rem',
      renderCell: (record) => <span className="text-xs text-[var(--muted)]">{formatIntakeDate(record)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '11rem',
      align: 'right',
      renderCell: (record) => {
        const nextStepLabel = getNextStepLabel?.(record) ?? null;
        const secondaryActionLabel = getSecondaryActionLabel?.(record) ?? null;

        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {nextStepLabel && onOpenNextStep ? (
              <CompactIconActionButton label={nextStepLabel} variant="small-secondary" icon="open" onClick={() => onOpenNextStep(record)} />
            ) : null}
            {secondaryActionLabel && onOpenSecondaryAction ? (
              <CompactIconActionButton label={secondaryActionLabel} variant="small-secondary" icon={secondaryActionIcon} onClick={() => onOpenSecondaryAction(record)} />
            ) : null}
            <CompactIconActionButton label={selectRecordLabel} variant="small-secondary" icon="open" onClick={() => onSelectRecord(record.id)} />
          </div>
        );
      },
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <QueueSearchToolbar
        className="mb-4"
        searchAriaLabel={searchAriaLabel}
        searchPlaceholder={searchPlaceholder}
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        refreshLabel={refreshLabel}
        refreshLoadingLabel={refreshLoadingLabel}
        refreshing={refreshing}
        onRefresh={onRefresh}
        sortAriaLabel={`Sort workflow hub directory. Current order: ${getDirectorySortLabel(sortMode)}`}
        sortValue={sortMode}
        onSortChange={(value) => onSortModeChange(value as 'intake-newest' | 'intake-oldest')}
        sortOptions={[
          { value: 'intake-newest', label: 'Intake Date: Newest First' },
          { value: 'intake-oldest', label: 'Intake Date: Oldest First' },
        ]}
        compactFilters
        filters={[
          {
            ariaLabel: 'Filter inventory by status',
            value: statusFilter,
            onChange: onStatusFilterChange,
            options: [
              { value: 'all', label: 'All Statuses' },
              ...statusOptions.map((status) => ({ value: status, label: status })),
            ],
          },
        ]}
      />

      <p className="mb-3 text-sm text-[var(--muted)]">
        Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> {resultLabel}
      </p>

      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <IntakeItemsMatrix items={records} columns={columns} getItemKey={(record) => record.id} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-center text-sm text-[var(--muted)]">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}