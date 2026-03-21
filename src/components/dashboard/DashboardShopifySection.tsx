import { PAGE_DEFINITIONS } from '@/auth/pages';
import type { WorkflowCard, DashboardTargetTab } from './dashboardTabTypes';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardShopifySectionProps {
  shopifyCards: WorkflowCard[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  spLoading: boolean;
  productsCount: number;
  activeProductsCount: number;
  draftProductsCount: number;
  archivedProductsCount: number;
  avgAskPrice: number;
  inventoryValue: number;
  grossMarginPct: number | null;
  acquisitionCost: number;
  totalAsk: number;
}

export function DashboardShopifySection(props: DashboardShopifySectionProps) {
  const {
    shopifyCards,
    onSelectTab,
    spLoading,
    productsCount,
    activeProductsCount,
    draftProductsCount,
    archivedProductsCount,
    avgAskPrice,
    inventoryValue,
    grossMarginPct,
    acquisitionCost,
    totalAsk,
  } = props;

  const safeProductsCount = Math.max(productsCount, 1);
  const activeShare = productsCount > 0 ? Math.round((activeProductsCount / safeProductsCount) * 100) : 0;
  const draftShare = productsCount > 0 ? Math.round((draftProductsCount / safeProductsCount) * 100) : 0;
  const archivedShare = productsCount > 0 ? Math.round((archivedProductsCount / safeProductsCount) * 100) : 0;
  const markupMultiple = acquisitionCost > 0 && totalAsk > 0 ? totalAsk / acquisitionCost : null;

  return (
    <div id="pipeline" className={`${sectionBaseClass} grid grid-cols-1 gap-4 md:grid-cols-2`}>
      <div className={`md:col-span-2 ${sectionHeaderClass}`}><h2 className={sectionHeaderLabelClass}>Shopify</h2></div>

      <section className="md:col-span-2 flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Sales Performance</h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Active Mix" value={spLoading ? '…' : `${activeShare}%`} />
          <StatTile label="Draft Mix" value={spLoading ? '…' : `${draftShare}%`} />
          <StatTile label="Archived Mix" value={spLoading ? '…' : `${archivedShare}%`} />
          <StatTile label="Markup Multiple" value={spLoading ? '…' : markupMultiple ? `${markupMultiple.toFixed(2)}x` : '—'} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
          <MetricRow label="Total Listings" value={spLoading ? '…' : productsCount} />
          <MetricRow label="Active" value={spLoading ? '…' : activeProductsCount} valueClass="text-green-400" />
          <MetricRow label="Draft / Pending" value={spLoading ? '…' : draftProductsCount} valueClass="text-amber-400" />
          <MetricRow label="Sold / Archived" value={spLoading ? '…' : archivedProductsCount} valueClass="font-medium text-[var(--muted)]" />
          <MetricRow label="Avg Ask Price" value={spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'} />
          <MetricRow label="Total Ask Value" value={spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
          <MetricRow label="Cost Basis" value={spLoading ? '…' : acquisitionCost > 0 ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} />
          <MetricRow label="Gross Margin" value={grossMarginPct !== null ? `${grossMarginPct}%` : '—'} valueClass={grossMarginPct !== null && grossMarginPct > 0 ? 'text-green-400' : 'text-[var(--ink)]'} />
          <MetricRow label="Potential Profit" value={acquisitionCost > 0 && totalAsk > 0 ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
        </div>
      </section>

      {shopifyCards.length > 0 && (
        <section className="md:col-span-2 flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
          <h2 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Shopify Queue & Products</h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {shopifyCards.map((card, index) => (
              <button
                key={`shopify-module-${card.id}-${index}`}
                type="button"
                className="flex h-full flex-col gap-3 rounded-[16px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(104,164,255,0.1),transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.9),rgba(8,15,26,0.96))] p-4 text-left text-[var(--ink)] transition hover:-translate-y-px hover:border-sky-400/35 hover:shadow-[0_18px_34px_rgba(2,6,23,0.28)]"
                onClick={() => onSelectTab(card.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-sky-200/80">{card.eyebrow}</p>
                    <h3 className="m-0 mt-1 text-[0.98rem] font-bold text-white">{card.title}</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.68rem] font-semibold text-white/70">{PAGE_DEFINITIONS[card.id].label}</span>
                </div>
                <p className="m-0 min-h-[3.6rem] text-[0.8rem] leading-[1.55] text-slate-300">{card.detail}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {card.stats.map((stat) => (
                    <span key={`${card.id}-${stat}`} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-100">{stat}</span>
                  ))}
                </div>
                <span className="text-[0.74rem] font-semibold text-[var(--accent)]">Open {PAGE_DEFINITIONS[card.id].label} →</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
      <p className="m-0 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="m-0 mt-1 text-[1.1rem] font-bold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function MetricRow({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line)] py-[0.6rem] [&:nth-last-child(-n+2)]:border-b-0">
      <span className="text-[0.8rem] text-[var(--muted)]">{label}</span>
      <span className={`text-[0.9rem] font-bold [font-variant-numeric:tabular-nums] ${valueClass ?? 'text-[var(--ink)]'}`}>{value}</span>
    </div>
  );
}
