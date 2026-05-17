import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import { QueueSearchToolbar } from '@/components/app/QueueSearchToolbar';
import type { AirtableRecord } from '@/types/airtable';
import { displayInventoryValue } from '@/services/inventoryDirectory';

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
  onOpenTestingForm: (recordId: string) => void;
  onOpenPhotosForm: (recordId: string) => void;
  onSelectRecord: (recordId: string) => void;
}

function componentText(record: AirtableRecord): string {
  return displayInventoryValue(record.fields['Component Type'] ?? record.fields.Component);
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
  onOpenTestingForm,
  onOpenPhotosForm,
  onSelectRecord,
}: InventoryDirectoryListSectionProps) {
  const columns: IntakeItemsMatrixColumn<AirtableRecord>[] = [
    {
      key: 'sku',
      label: 'SKU',
      width: '9rem',
      renderCell: (record) => <span className="font-medium text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</span>,
    },
    {
      key: 'item',
      label: 'Item',
      width: 'minmax(0,1.55fr)',
      renderCell: (record) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-[var(--ink)]">{displayInventoryValue(record.fields.Make)} · {displayInventoryValue(record.fields.Model)}</div>
          <div className="mt-0.5 text-xs text-[var(--muted)]">{componentText(record)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '10rem',
      renderCell: (record) => <span className="text-xs text-[var(--muted)]">{displayInventoryValue(record.fields.Status)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '11rem',
      align: 'right',
      renderCell: (record) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <CompactIconActionButton label="Open Manual Intake" variant="small-secondary" onClick={() => onOpenManualIntake(record.id)} />
          <CompactIconActionButton label="Open Testing" variant="small-secondary" onClick={() => onOpenTestingForm(record.id)} />
          <CompactIconActionButton label="Open Photos" variant="small-secondary" onClick={() => onOpenPhotosForm(record.id)} />
          <CompactIconActionButton label="Edit Inventory Record" variant="small-secondary" onClick={() => onSelectRecord(record.id)} />
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