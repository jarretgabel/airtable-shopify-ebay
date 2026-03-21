import { PAGE_DEFINITIONS } from '@/auth/pages';
import type { WorkflowCard, DashboardTargetTab } from './dashboardTabTypes';

const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardEbaySectionProps {
  cards: WorkflowCard[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  ebayLoading: boolean;
  ebayAuthenticated: boolean;
  ebayRestoringSession: boolean;
  ebayError: string | null;
  ebayTotal: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
}

export function DashboardEbaySection({
  cards,
  onSelectTab,
  ebayLoading,
  ebayAuthenticated,
  ebayRestoringSession,
  ebayError,
  ebayTotal,
  ebayPublishedCount,
  ebayDraftCount,
}: DashboardEbaySectionProps) {
  if (cards.length === 0) return null;

  const safeTotal = Math.max(ebayTotal, 1);
  const liveShare = ebayTotal > 0 ? Math.round((ebayPublishedCount / safeTotal) * 100) : 0;
  const draftShare = ebayTotal > 0 ? Math.round((ebayDraftCount / safeTotal) * 100) : 0;
  const withOffers = ebayPublishedCount + ebayDraftCount;
  const coverageRate = ebayTotal > 0 ? Math.round((withOffers / safeTotal) * 100) : 0;
  const noOfferCount = Math.max(0, ebayTotal - withOffers);
  const connectionValue = ebayRestoringSession ? 'Restoring' : ebayAuthenticated ? 'Connected' : 'Disconnected';

  return (
    <section id="ebay-workflows" className={`${sectionBaseClass} flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
      <div className={sectionHeaderClass}><h2 className={sectionHeaderLabelClass}>eBay</h2></div>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--bg)] p-5">
        <h3 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Sales Performance</h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Live Share" value={ebayLoading ? '…' : `${liveShare}%`} />
          <StatTile label="Draft Share" value={ebayLoading ? '…' : `${draftShare}%`} />
          <StatTile label="Offer Coverage" value={ebayLoading ? '…' : `${coverageRate}%`} />
          <StatTile label="Connection" value={ebayLoading ? '…' : connectionValue} />
        </div>

        {ebayError ? (
          <p className="m-0 rounded-[10px] border border-red-500/30 bg-red-950/20 px-4 py-3 text-[0.84rem] text-red-300">{ebayError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
            <MetricRow label="Tracked SKUs" value={ebayLoading ? '…' : ebayTotal} />
            <MetricRow label="Live Offers" value={ebayLoading ? '…' : ebayPublishedCount} valueClass="text-green-400" />
            <MetricRow label="Draft Offers" value={ebayLoading ? '…' : ebayDraftCount} valueClass="text-amber-400" />
            <MetricRow label="Without Offer" value={ebayLoading ? '…' : noOfferCount} valueClass="text-[var(--muted)]" />
            <MetricRow label="Offer Coverage" value={ebayLoading ? '…' : `${coverageRate}%`} />
            <MetricRow label="Connection Status" value={ebayLoading ? '…' : connectionValue} valueClass={ebayAuthenticated ? 'text-green-400' : 'text-[var(--ink)]'} />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]">
        <h3 className="m-0 flex items-baseline gap-2 border-b border-[var(--line)] pb-3 text-[0.92rem] font-bold text-[var(--ink)]">Publishing & Queue</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <button
              key={`ebay-module-${card.id}`}
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
                {card.stats.map((stat, index) => (
                  <span key={`${card.id}-${stat}-${index}`} className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-100">{stat}</span>
                ))}
              </div>
              <span className="text-[0.74rem] font-semibold text-[var(--accent)]">Open {PAGE_DEFINITIONS[card.id].label} →</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
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