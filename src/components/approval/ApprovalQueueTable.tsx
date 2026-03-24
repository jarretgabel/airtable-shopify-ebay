import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { displayValue } from '@/stores/approvalStore';
import { trackWorkflowEvent } from '@/services/workflowAnalytics';
import { AirtableRecord } from '@/types/airtable';

function ApprovedBadge({ value }: { value: unknown }) {
  const str = String(value ?? '').trim();
  const approved = str.toLowerCase() === 'true' || str.toLowerCase() === 'yes' || str === '1';

  if (approved) {
    return (
      <span className="inline-block rounded-full border border-emerald-400/35 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-emerald-200">
        Approved
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full border border-amber-400/35 bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-amber-200">
      Unapproved
    </span>
  );
}

interface ApprovalQueueTableProps {
  records: AirtableRecord[];
  approvedFieldName: string;
  requiredFieldNames?: string[];
  titleFieldName: string;
  conditionFieldName: string;
  formatFieldName: string;
  priceFieldName: string;
  vendorFieldName: string;
  qtyFieldName: string;
  openRecord: (record: AirtableRecord) => void;
  onSelectRecord: (recordId: string) => void;
}

export function ApprovalQueueTable({
  records,
  approvedFieldName,
  requiredFieldNames = [],
  titleFieldName,
  conditionFieldName,
  formatFieldName,
  priceFieldName,
  vendorFieldName,
  qtyFieldName,
  openRecord,
  onSelectRecord,
}: ApprovalQueueTableProps) {
  const [search, setSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'unapproved'>('all');
  const [sortBy, setSortBy] = useState<'title-asc' | 'title-desc' | 'price-desc' | 'price-asc' | 'vendor-asc' | 'qty-desc' | 'approval'>('title-asc');
  const deferredSearch = useDeferredValue(search);

  const isApprovedValue = (value: unknown): boolean => {
    const str = String(value ?? '').trim().toLowerCase();
    return str === 'true' || str === 'yes' || str === '1';
  };

  const parseNumber = (value: unknown): number => {
    const n = Number.parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const preparedRecords = useMemo(
    () => records.map((record) => {
      const title = displayValue(record.fields[titleFieldName]);
      const vendor = vendorFieldName ? displayValue(record.fields[vendorFieldName]) : '';
      const condition = conditionFieldName ? displayValue(record.fields[conditionFieldName]) : '';
      const format = formatFieldName ? displayValue(record.fields[formatFieldName]) : '';
      const rawPrice = priceFieldName ? record.fields[priceFieldName] : null;
      const rawQty = qtyFieldName ? record.fields[qtyFieldName] : null;

      const requiredComplete = requiredFieldNames.every((fieldName) => {
        const rawValue = record.fields[fieldName];
        if (rawValue === null || rawValue === undefined) return false;

        const stringValue = String(rawValue).trim();
        if (!stringValue) return false;

        if (fieldName.toLowerCase().includes('price')) {
          const numericValue = Number.parseFloat(stringValue.replace(/[^0-9.-]/g, ''));
          return Number.isFinite(numericValue) && numericValue > 0;
        }

        return true;
      });

      return {
        record,
        title,
        titleLower: title.toLowerCase(),
        vendor,
        vendorLower: vendor.toLowerCase(),
        condition,
        conditionLower: condition.toLowerCase(),
        format,
        formatLower: format.toLowerCase(),
        price: priceFieldName ? parseNumber(rawPrice) : 0,
        qty: qtyFieldName ? parseNumber(rawQty) : 0,
        approved: isApprovedValue(record.fields[approvedFieldName]),
        requiredComplete,
      };
    }),
    [approvedFieldName, conditionFieldName, formatFieldName, priceFieldName, qtyFieldName, records, requiredFieldNames, titleFieldName, vendorFieldName],
  );

  const filteredAndSortedRecords = useMemo(() => {
    let list = [...preparedRecords];

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      list = list.filter((item) => {
        return item.titleLower.includes(q)
          || item.vendorLower.includes(q)
          || item.conditionLower.includes(q)
          || item.formatLower.includes(q);
      });
    }

    if (approvalFilter !== 'all') {
      list = list.filter((item) => {
        return approvalFilter === 'approved' ? item.approved : !item.approved;
      });
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'title-asc':
          return a.titleLower.localeCompare(b.titleLower);
        case 'title-desc':
          return b.titleLower.localeCompare(a.titleLower);
        case 'price-desc':
          return b.price - a.price;
        case 'price-asc':
          return a.price - b.price;
        case 'vendor-asc':
          return a.vendorLower.localeCompare(b.vendorLower);
        case 'qty-desc':
          return b.qty - a.qty;
        case 'approval':
          return Number(b.approved) - Number(a.approved);
        default:
          return 0;
      }
    });

    return list.map((item) => item.record);
  }, [
    deferredSearch,
    approvalFilter,
    preparedRecords,
    sortBy,
  ]);

  const preparedRecordById = useMemo(
    () => new Map(preparedRecords.map((item) => [item.record.id, item])),
    [preparedRecords],
  );

  useEffect(() => {
    trackWorkflowEvent('approval_queue_filtered', {
      searchLength: deferredSearch.trim().length,
      approvalFilter,
      sortBy,
      visibleRows: filteredAndSortedRecords.length,
      totalRows: records.length,
    });
  }, [approvalFilter, deferredSearch, filteredAndSortedRecords.length, records.length, sortBy]);

  // Determine which columns have data across any record
  const { hasCondition, hasFormat, hasPrice, hasVendor, hasQty } = useMemo(() => {
    const hasData = (fieldName: string) => fieldName.length > 0 && records.some((r) => r.fields[fieldName] != null && r.fields[fieldName] !== '');
    return {
      hasCondition: hasData(conditionFieldName),
      hasFormat: hasData(formatFieldName),
      hasPrice: hasData(priceFieldName),
      hasVendor: hasData(vendorFieldName),
      hasQty: hasData(qtyFieldName),
    };
  }, [conditionFieldName, formatFieldName, priceFieldName, qtyFieldName, records, vendorFieldName]);
  const columnCount = 3
    + (hasPrice ? 1 : 0)
    + (hasVendor ? 1 : 0)
    + (hasCondition ? 1 : 0)
    + (hasFormat ? 1 : 0)
    + (hasQty ? 1 : 0)
    + (requiredFieldNames.length > 0 ? 1 : 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, vendor, condition, format..."
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-[0.82rem] text-[var(--ink)] placeholder-[var(--muted)] outline-none transition-colors focus:border-[var(--accent)]"
          aria-label="Search listing approval rows"
        />
        <select
          value={approvalFilter}
          onChange={(event) => setApprovalFilter(event.target.value as typeof approvalFilter)}
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
          aria-label="Filter by approval status"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="unapproved">Unapproved</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
          className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 py-2 text-[0.82rem] text-[var(--ink)] outline-none transition-colors focus:border-[var(--accent)]"
          aria-label="Sort listing approval rows"
        >
          <option value="title-asc">Title A→Z</option>
          <option value="title-desc">Title Z→A</option>
          {hasPrice && <option value="price-desc">Price high→low</option>}
          {hasPrice && <option value="price-asc">Price low→high</option>}
          {hasVendor && <option value="vendor-asc">Vendor A→Z</option>}
          {hasQty && <option value="qty-desc">Qty high→low</option>}
          <option value="approval">Approved first</option>
        </select>
      </div>

      <p className="m-0 text-sm text-[var(--muted)]">
        <strong>{filteredAndSortedRecords.length}</strong>
        {filteredAndSortedRecords.length !== records.length ? ` of ${records.length}` : ''} listing rows.
      </p>

      <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Item Title</th>
            {hasPrice && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Buy It Now/Starting Bid Price</th>}
            {hasVendor && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Vendor / Brand</th>}
            {hasCondition && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Condition</th>}
            {hasFormat && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Format</th>}
            {hasQty && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Qty</th>}
            {requiredFieldNames.length > 0 && <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Required Fields</th>}
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Approved</th>
            <th className="border-b-2 border-[var(--line)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredAndSortedRecords.map((record) => (
            <tr
              key={record.id}
              className="cursor-pointer transition-colors hover:bg-white/5"
              onClick={() => openRecord(record)}
            >
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields[titleFieldName])}</td>
              {hasPrice && (
                <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle font-semibold text-[var(--ink)]">
                  {record.fields[priceFieldName] != null && record.fields[priceFieldName] !== ''
                    ? `$${record.fields[priceFieldName]}`
                    : '—'}
                </td>
              )}
              {hasVendor && (
                <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle text-[var(--muted)]">{displayValue(record.fields[vendorFieldName])}</td>
              )}
              {hasCondition && <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields[conditionFieldName])}</td>}
              {hasFormat && <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">{displayValue(record.fields[formatFieldName])}</td>}
              {hasQty && (
                <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle text-center text-[var(--muted)]">{displayValue(record.fields[qtyFieldName])}</td>
              )}
              {requiredFieldNames.length > 0 && (
                <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">
                  {preparedRecordById.get(record.id)?.requiredComplete ? (
                    <span className="inline-block rounded-full border border-emerald-400/35 bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-emerald-200">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-rose-400/35 bg-rose-500/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em] text-rose-200">
                      Missing
                    </span>
                  )}
                </td>
              )}
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle"><ApprovedBadge value={record.fields[approvedFieldName]} /></td>
              <td className="border-b border-[var(--line)] px-3 py-2.5 align-middle">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-xs font-bold text-[var(--ink)] transition-colors hover:border-blue-300/45 hover:bg-white/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    openRecord(record);
                    onSelectRecord(record.id);
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
          {filteredAndSortedRecords.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="border-b border-[var(--line)] px-3 py-8 text-center text-sm text-[var(--muted)]">
                No listing rows match the current search/filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
