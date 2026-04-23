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
  onOpenIncomingGearForm: (recordId: string) => void;
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
  onOpenIncomingGearForm,
  onOpenTestingForm,
  onOpenPhotosForm,
  onSelectRecord,
}: InventoryDirectoryListSectionProps) {
  const labelClassName = 'text-sm font-semibold text-[var(--ink)]';
  const inputClassName = 'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20';

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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">SKU</th>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Make</th>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Model</th>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Component</th>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Status</th>
              <th className="border-b border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              return (
                <tr key={record.id} className="transition hover:bg-white/5">
                  <td className="border-b border-[var(--line)] px-3 py-2.5 font-medium text-[var(--ink)]">{displayInventoryValue(record.fields.SKU)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{displayInventoryValue(record.fields.Make)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{displayInventoryValue(record.fields.Model)}</td>
                  <td className="max-w-[260px] border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{componentText(record)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-2.5 text-[var(--muted)]">{displayInventoryValue(record.fields.Status)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenIncomingGearForm(record.id)}
                      >
                        Incoming Gear
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenTestingForm(record.id)}
                      >
                        Testing
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onOpenPhotosForm(record.id)}
                      >
                        Photos
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        onClick={() => onSelectRecord(record.id)}
                      >
                        Full Editor
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-center text-sm text-[var(--muted)]" colSpan={6}>
                  No inventory records match the current search and status filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}