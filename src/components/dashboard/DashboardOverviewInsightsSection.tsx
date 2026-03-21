import { PAGE_DEFINITIONS } from '@/auth/pages';
import type { DashboardInsight, DashboardTargetTab, TrendSummary } from './dashboardTabTypes';

const kpiCardClass = 'w-full appearance-none rounded-[14px] border border-[var(--line)] border-t-[3px] bg-[var(--panel)] px-4 pb-3 pt-3 text-left text-[var(--ink)] shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)] transition hover:-translate-y-px hover:shadow-[0_2px_6px_rgba(17,32,49,0.09),0_8px_24px_rgba(17,32,49,0.08)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-200';
const trendToneClass = {
  up: 'text-green-700',
  down: 'text-amber-400',
  flat: 'text-[var(--muted)]',
} as const satisfies Record<TrendSummary['direction'], string>;
const insightToneClass = {
  critical: 'border-red-500/30 bg-red-950/30 text-red-300',
  warning: 'border-amber-500/30 bg-amber-950/30 text-amber-300',
  info: 'border-blue-500/30 bg-blue-950/30 text-blue-300',
  positive: 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300',
} as const;
const insightBadgeClass = {
  critical: 'bg-red-900/50 text-red-300',
  warning: 'bg-amber-900/50 text-amber-300',
  info: 'bg-blue-900/50 text-blue-300',
  positive: 'bg-emerald-900/50 text-emerald-300',
} as const;
const sectionBaseClass = 'scroll-mt-24';
const sectionHeaderClass = 'mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1';
const sectionHeaderLabelClass = 'm-0 text-[1.05rem] font-semibold text-[var(--ink)]';

interface DashboardOverviewSectionProps {
  jfLoading: boolean;
  jfSubmissionCount: number;
  thisWeekCount: number;
  recentCount: number;
  totalNewSubmissions: number;
  spLoading: boolean;
  draftCount: number;
  activeCount: number;
  archivedCount: number;
  atLoading: boolean;
  acquisitionCost: number;
  nonEmptyListingCount: number;
  inventoryValue: number;
  avgAskPrice: number;
  sellThroughPct: number | null;
  grossMarginPct: number | null;
  submissionsTrend: TrendSummary;
  dealsTrend: TrendSummary;
  acquisitionTrend: TrendSummary;
  inventoryTrend: TrendSummary;
  salesTrend: TrendSummary;
  marginTrend: TrendSummary;
  onSelectTab: (tab: DashboardTargetTab) => void;
}

export function DashboardOverviewSection(props: DashboardOverviewSectionProps) {
  const {
    jfLoading,
    jfSubmissionCount,
    thisWeekCount,
    recentCount,
    totalNewSubmissions,
    spLoading,
    draftCount,
    activeCount,
    archivedCount,
    atLoading,
    acquisitionCost,
    nonEmptyListingCount,
    inventoryValue,
    avgAskPrice,
    sellThroughPct,
    grossMarginPct,
    submissionsTrend,
    dealsTrend,
    acquisitionTrend,
    inventoryTrend,
    salesTrend,
    marginTrend,
    onSelectTab,
  } = props;

  return (
    <section id="overview" className={`${sectionBaseClass} flex flex-col gap-3`}>
      <div className={sectionHeaderClass}>
        <h2 className={sectionHeaderLabelClass}>Dashboard</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button type="button" className={`${kpiCardClass} border-t-blue-500`} onClick={() => onSelectTab('jotform')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Incoming Gear Submissions</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{jfLoading ? '…' : jfSubmissionCount.toLocaleString()}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]"><strong className="font-semibold text-[var(--accent)]">{thisWeekCount}</strong> this week &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{recentCount}</strong> last 30 days{totalNewSubmissions > 0 && <><span>&nbsp;·&nbsp;</span><span className="font-semibold text-red-600">{totalNewSubmissions} unread</span></>}</p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[submissionsTrend.direction]}`}>{submissionsTrend.text}</p>
        </button>

        <button type="button" className={`${kpiCardClass} border-t-amber-500`} onClick={() => onSelectTab('shopify')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Deals in Progress</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{spLoading ? '…' : draftCount}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]"><strong className="font-semibold text-[var(--accent)]">{activeCount}</strong> live inventory &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> closed out</p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[dealsTrend.direction]}`}>{dealsTrend.text}</p>
        </button>

        <button type="button" className={`${kpiCardClass} border-t-violet-500`} onClick={() => onSelectTab('airtable')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Acquisition Costs</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{atLoading ? '…' : acquisitionCost > 0 ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">Using Airtable <strong className="font-semibold text-[var(--accent)]">Price</strong> from {nonEmptyListingCount} records</p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[acquisitionTrend.direction]}`}>{acquisitionTrend.text}</p>
        </button>

        <button type="button" className={`${kpiCardClass} border-t-emerald-500`} onClick={() => onSelectTab('shopify')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Inventory Value</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">Active listings at ask price &nbsp;·&nbsp; avg <strong className="font-semibold text-[var(--accent)]">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</strong></p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[inventoryTrend.direction]}`}>{inventoryTrend.text}</p>
        </button>

        <button type="button" className={`${kpiCardClass} border-t-slate-600`} onClick={() => onSelectTab('shopify')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Sales Performance</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{sellThroughPct !== null ? `${sellThroughPct}%` : '—'}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]"><strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> sold or archived &nbsp;·&nbsp; sell-through rate</p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[salesTrend.direction]}`}>{salesTrend.text}</p>
        </button>

        <button type="button" className={`${kpiCardClass} border-t-teal-500`} onClick={() => onSelectTab('airtable')}>
          <div className="mb-0.5 flex items-center gap-2"><span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Profit Margins</span></div>
          <p className="m-0 text-[1.65rem] font-bold leading-none tracking-[-0.02em] text-[var(--ink)]">{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</p>
          <p className="m-0 text-[0.78rem] leading-[1.5] text-[var(--muted)]">{grossMarginPct !== null ? 'Derived from Shopify ask value and Airtable Price' : 'Add numeric Airtable prices to calculate'}</p>
          <p className={`mt-auto pt-1.5 text-[0.74rem] font-bold uppercase tracking-[0.02em] ${trendToneClass[marginTrend.direction]}`}>{marginTrend.text}</p>
        </button>
      </div>
    </section>
  );
}

export function DashboardInsightsSection({ insights, onSelectTab }: { insights: DashboardInsight[]; onSelectTab: (tab: DashboardTargetTab) => void }) {
  return (
    <section id="insights" className={`${sectionBaseClass} flex flex-col gap-4 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]`}>
      <div className={sectionHeaderClass}>
        <h2 className={sectionHeaderLabelClass}>Insights</h2>
      </div>
      {insights.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {insights.map((insight) => (
            <article key={insight.id} className={`rounded-xl border px-4 py-3 ${insightToneClass[insight.severity]}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="m-0 text-[0.86rem] font-bold">{insight.title}</h3>
                <span className={`rounded-full px-2 py-[0.15rem] text-[0.64rem] font-bold uppercase tracking-[0.07em] ${insightBadgeClass[insight.severity]}`}>{insight.severity}</span>
              </div>
              <p className="m-0 text-[0.8rem] leading-[1.45] opacity-90">{insight.detail}</p>
              {insight.targetTab && <button type="button" className="mt-3 rounded-lg border border-current/30 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold transition hover:bg-white/20" onClick={() => onSelectTab(insight.targetTab!)}>Review in {PAGE_DEFINITIONS[insight.targetTab].label} →</button>}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.84rem] text-emerald-200">No active alerts right now. The dashboard will surface warnings here when inventory, inquiries, or sales trends drift.</div>
      )}
    </section>
  );
}
