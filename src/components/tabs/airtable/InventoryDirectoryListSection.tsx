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
  statusOptions: string[];
  refreshing?: boolean;
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onRefresh?: () => void;
  onOpenManualIntake: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
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

export function InventoryDirectoryListSection({
  records,
  totalCount,
  searchTerm,
  statusFilter,
  statusOptions,
  refreshing = false,
  onSearchTermChange,
  onStatusFilterChange,
  onRefresh,
  onOpenManualIntake,
  onSelectRecord,
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
      renderCell: (record) => <div className="min-w-0 truncate text-sm text-[var(--ink)]">{displayInventoryValue(getInventoryDirectoryItemLabel(record.fields))}</div>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '14rem',
      renderCell: (record) => {
        const statusLabel = displayInventoryValue(getInventoryDirectoryStatus(record.fields)) || 'Unknown';

        return <span className={getWorkflowStatusChipClasses(statusLabel)}>{statusLabel}</span>;
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
      width: '6rem',
      align: 'right',
      renderCell: (record) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <CompactIconActionButton label="Open Manual Intake" variant="small-secondary" icon="form" onClick={() => onOpenManualIntake(record.id)} />
          <CompactIconActionButton label="Edit Inventory Record" variant="small-secondary" icon="edit" onClick={() => onSelectRecord(record.id)} />
        </div>
      ),
    },
  ];

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <QueueSearchToolbar
        className="mb-4"
        searchAriaLabel="Search inventory"
        searchPlaceholder="Search by SKU, make, model, component, or status"
        searchValue={searchTerm}
        onSearchChange={onSearchTermChange}
        refreshLabel="Refresh inventory directory"
        refreshLoadingLabel="Refreshing inventory directory"
        refreshing={refreshing}
        onRefresh={onRefresh}
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
        Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> SB Inventory records
      </p>

      {records.length > 0 ? (
        <div className="overflow-x-auto">
          <IntakeItemsMatrix items={records} columns={columns} getItemKey={(record) => record.id} />
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-5 text-center text-sm text-[var(--muted)]">
          No inventory records match the current search and status filters.
        </div>
      )}
    </section>
  );
}