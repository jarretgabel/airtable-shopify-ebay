import { spinnerClass } from '@/components/tabs/uiClasses';
import type { AirtableTypeRow, DashboardTargetTab } from './dashboardTabTypes';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardAirtableSectionProps {
  atLoading: boolean;
  nonEmptyListingCount: number;
  airtableInventoryValue: number;
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  componentTypeSummary: Array<[string, number]>;
  airtableBrandSummary: Array<[string, number]>;
  airtableDistributorSummary: Array<[string, { count: number; total: number }]>;
  airtableTypeTable: AirtableTypeRow[];
  maxComponentTypeCount: number;
  maxAirtableBrandCount: number;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

function toPercent(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((count / max) * 100);
}

export function DashboardAirtableSection(props: DashboardAirtableSectionProps) {
  const {
    atLoading,
    nonEmptyListingCount,
    airtableInventoryValue,
    uniqueAirtableBrands,
    uniqueAirtableTypes,
    componentTypeSummary,
    airtableBrandSummary,
    airtableDistributorSummary,
    airtableTypeTable,
    maxComponentTypeCount,
    maxAirtableBrandCount,
    onSelectTab,
  } = props;

  return (
    <section id="inventory" className={`${sectionBaseClass} flex flex-col gap-[1.1rem] rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
      <div className={sectionHeaderClass}><h2 className={sectionHeaderLabelClass}>Airtable</h2></div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h3 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Airtable Inventory Recap <span className="text-[0.72rem] font-medium tracking-[0.02em] text-[var(--muted)]">All products in Airtable</span></h3></div>
        <button type="button" className="cursor-pointer self-start rounded-lg border border-[var(--line)] bg-transparent px-[0.85rem] py-[0.38rem] text-[0.78rem] font-semibold text-[var(--accent)] transition-[background,border-color] duration-[140ms] hover:border-[var(--accent)] hover:bg-[var(--panel)]" onClick={() => onSelectTab('airtable')}>Open Airtable Inventory →</button>
      </div>

      {atLoading ? (
        <div className="flex items-center gap-3 py-2 text-[var(--muted)]"><div className={spinnerClass} /><p>Loading Airtable inventory…</p></div>
      ) : nonEmptyListingCount > 0 ? (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</span><strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{nonEmptyListingCount}</strong></article>
            <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Brands</span><strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{uniqueAirtableBrands}</strong></article>
            <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Component Types</span><strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{uniqueAirtableTypes}</strong></article>
            <article className="flex flex-col gap-1.5 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4 leading-tight shadow-[0_8px_24px_rgba(17,32,49,0.04)]"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Tagged Value</span><strong className="text-[1.3rem] leading-[1.1] text-[var(--ink)] [font-variant-numeric:tabular-nums]">{airtableInventoryValue > 0 ? `$${airtableInventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</strong></article>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4"><h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">By Component Type</h3><ul className="m-0 flex list-none flex-col gap-3 p-0">{componentTypeSummary.map(([label, count], index) => <li key={`${label}-${index}`} className="grid grid-cols-[minmax(90px,140px)_1fr_32px] items-center gap-3"><span className="truncate whitespace-nowrap text-[0.82rem] text-[var(--ink)]">{label}</span><div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full min-w-[6px] rounded-full bg-gradient-to-r from-teal-500 to-teal-300" style={{ width: `${toPercent(count, maxComponentTypeCount)}%` }} /></div><span className="text-right text-[0.8rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{count}</span></li>)}</ul></section>
            <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4"><h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">Top Brands</h3><ul className="m-0 flex list-none flex-col gap-3 p-0">{airtableBrandSummary.map(([label, count], index) => <li key={`${label}-${index}`} className="grid grid-cols-[minmax(90px,140px)_1fr_32px] items-center gap-3"><span className="truncate whitespace-nowrap text-[0.82rem] text-[var(--ink)]">{label}</span><div className="h-2.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full min-w-[6px] rounded-full bg-gradient-to-r from-blue-500 to-blue-300" style={{ width: `${toPercent(count, maxAirtableBrandCount)}%` }} /></div><span className="text-right text-[0.8rem] font-bold text-[var(--ink)] [font-variant-numeric:tabular-nums]">{count}</span></li>)}</ul></section>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
              <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">By Distributor</h3>
              <div className="overflow-x-auto"><table className="w-full border-collapse text-[0.84rem]"><thead><tr><th className="border-b border-[var(--line)] px-2 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Distributor</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Tagged Value</th></tr></thead><tbody className="[&>tr:last-child>td]:border-b-0">{airtableDistributorSummary.map(([distributor, summary], index) => <tr key={`${distributor}-${index}`}><td className="border-b border-[var(--line)] px-2 py-2 align-middle">{distributor}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{summary.count}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{summary.total > 0 ? `$${summary.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td></tr>)}</tbody></table></div>
            </section>
            <section className="rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-4">
              <h3 className="mb-3 text-[0.9rem] font-bold text-[var(--ink)]">Component Summary</h3>
              <div className="overflow-x-auto"><table className="w-full border-collapse text-[0.84rem]"><thead><tr><th className="border-b border-[var(--line)] px-2 py-2 text-left text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Type</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Products</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Brands</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Avg Price</th><th className="border-b border-[var(--line)] px-2 py-2 text-right text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Total</th></tr></thead><tbody className="[&>tr:last-child>td]:border-b-0">{airtableTypeTable.map((row, index) => <tr key={`${row.type}-${index}`}><td className="border-b border-[var(--line)] px-2 py-2 align-middle">{row.type}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.count}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.brandCount}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.averagePrice > 0 ? `$${Math.round(row.averagePrice).toLocaleString()}` : '—'}</td><td className="border-b border-[var(--line)] px-2 py-2 text-right align-middle">{row.totalPrice > 0 ? `$${row.totalPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td></tr>)}</tbody></table></div>
            </section>
          </div>
        </>
      ) : (
        <p className="m-0 text-[var(--muted)]">No Airtable inventory records available yet.</p>
      )}
    </section>
  );
}
