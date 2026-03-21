import { PAGE_DEFINITIONS } from '@/auth/pages';
import { DashboardKpiCard, DashboardSectionPanel, DashboardSubPanel } from './dashboardPrimitives';
import type { DashboardInsight, DashboardTargetTab, TrendSummary } from './dashboardTabTypes';

const trendToneClass = {
  up: 'text-green-300',
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
  embedded?: boolean;
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
    embedded,
  } = props;

  const content = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <DashboardKpiCard
          borderToneClass="border-t-blue-500"
          eyebrow="Incoming Gear Submissions"
          value={jfLoading ? '…' : jfSubmissionCount.toLocaleString()}
          detail={<><strong className="font-semibold text-[var(--accent)]">{thisWeekCount}</strong> this week &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{recentCount}</strong> last 30 days{totalNewSubmissions > 0 && <><span>&nbsp;·&nbsp;</span><span className="font-semibold text-red-600">{totalNewSubmissions} unread</span></>}</>}
          trend={submissionsTrend.text}
          trendClass={trendToneClass[submissionsTrend.direction]}
          onClick={() => onSelectTab('jotform')}
        />

        <DashboardKpiCard
          borderToneClass="border-t-amber-500"
          eyebrow="Deals in Progress"
          value={spLoading ? '…' : draftCount}
          detail={<><strong className="font-semibold text-[var(--accent)]">{activeCount}</strong> live inventory &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> closed out</>}
          trend={dealsTrend.text}
          trendClass={trendToneClass[dealsTrend.direction]}
          onClick={() => onSelectTab('shopify')}
        />

        <DashboardKpiCard
          borderToneClass="border-t-violet-500"
          eyebrow="Acquisition Costs"
          value={atLoading ? '…' : acquisitionCost > 0 ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          detail={<>Using Airtable <strong className="font-semibold text-[var(--accent)]">Price</strong> from {nonEmptyListingCount} records</>}
          trend={acquisitionTrend.text}
          trendClass={trendToneClass[acquisitionTrend.direction]}
          onClick={() => onSelectTab('airtable')}
        />

        <DashboardKpiCard
          borderToneClass="border-t-emerald-500"
          eyebrow="Inventory Value"
          value={spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          detail={<>Active listings at ask price &nbsp;·&nbsp; avg <strong className="font-semibold text-[var(--accent)]">{spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'}</strong></>}
          trend={inventoryTrend.text}
          trendClass={trendToneClass[inventoryTrend.direction]}
          onClick={() => onSelectTab('shopify')}
        />

        <DashboardKpiCard
          borderToneClass="border-t-slate-600"
          eyebrow="Sales Performance"
          value={sellThroughPct !== null ? `${sellThroughPct}%` : '—'}
          detail={<><strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> sold or archived &nbsp;·&nbsp; sell-through rate</>}
          trend={salesTrend.text}
          trendClass={trendToneClass[salesTrend.direction]}
          onClick={() => onSelectTab('shopify')}
        />

        <DashboardKpiCard
          borderToneClass="border-t-teal-500"
          eyebrow="Profit Margins"
          value={grossMarginPct !== null ? `${grossMarginPct}%` : '—'}
          detail={grossMarginPct !== null ? 'Derived from Shopify ask value and Airtable Price' : 'Add numeric Airtable prices to calculate'}
          trend={marginTrend.text}
          trendClass={trendToneClass[marginTrend.direction]}
          onClick={() => onSelectTab('airtable')}
        />
      </div>
  );

  if (embedded) {
    return <DashboardSubPanel title="Dashboard">{content}</DashboardSubPanel>;
  }

  return (
    <section id="overview" className={`${sectionBaseClass} flex flex-col gap-3`}>
      <div className={sectionHeaderClass}>
        <h2 className={sectionHeaderLabelClass}>Dashboard</h2>
      </div>
      {content}
    </section>
  );
}

export function DashboardInsightsSection({
  insights,
  onSelectTab,
  embedded,
}: {
  insights: DashboardInsight[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  embedded?: boolean;
}) {
  const content = insights.length > 0 ? (
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
  );

  if (embedded) {
    return <DashboardSubPanel title="Insights">{content}</DashboardSubPanel>;
  }

  return (
    <DashboardSectionPanel id="insights" title="Insights">
      {content}
    </DashboardSectionPanel>
  );
}
