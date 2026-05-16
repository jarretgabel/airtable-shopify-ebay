import { CompactIconActionButton } from '@/components/app/CompactIconActionButton';
import { IntakeItemsMatrix, type IntakeItemsMatrixColumn } from '@/components/app/IntakeItemsMatrix';
import type { AirtableRecord } from '@/types/airtable';
import { displayInventoryValue } from '@/services/inventoryDirectory';

interface InventoryDirectoryListSectionProps {
  records: AirtableRecord[];
  totalCount: number;
  searchTerm: string;
  statusFilter: string;
  statusOptions: string[];
  onSearchTermChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
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
  onSearchTermChange,
  onStatusFilterChange,
  onOpenManualIntake,
  onOpenTestingForm,
  onOpenPhotosForm,
  onSelectRecord,
}: InventoryDirectoryListSectionProps) {
  const labelClassName = 'text-sm font-semibold text-[var(--ink)]';
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';
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
      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <label className="flex flex-col gap-1.5">
          <span className={labelClassName}>Search Inventory</span>
          <input
            type="text"
            className={inputClassName}
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.currentTarget.value)}
            placeholder="Search by SKU, make, model, component, or status"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={labelClassName}>Status Filter</span>
          <select className={inputClassName} value={statusFilter} onChange={(event) => onStatusFilterChange(event.currentTarget.value)}>
            <option value="all">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>

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