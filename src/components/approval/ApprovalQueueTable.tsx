import { displayValue } from '@/stores/approvalStore';
import { AirtableRecord } from '@/types/airtable';

interface ApprovalQueueTableProps {
  records: AirtableRecord[];
  approvedFieldName: string;
  openRecord: (record: AirtableRecord) => void;
  onSelectRecord: (recordId: string) => void;
}

export function ApprovalQueueTable({
  records,
  approvedFieldName,
  openRecord,
  onSelectRecord,
}: ApprovalQueueTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Item Title</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">SKU</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Approved</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Condition</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Format</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className="cursor-pointer transition hover:bg-slate-50/70"
              onClick={() => openRecord(record)}
            >
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields['Item Title'])}</td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields['Custom Label SKU'])}</td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields[approvedFieldName])}</td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields['Item Condition'])}</td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields['Listing Format'])}</td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-bold text-[var(--ink)] transition hover:border-blue-200 hover:bg-slate-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectRecord(record.id);
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
