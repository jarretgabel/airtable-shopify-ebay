import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import { DashboardKpiCard, DashboardSectionPanel, DashboardSubPanel } from './dashboardPrimitives';
import type { DashboardInsight, DashboardTargetTab, TrendSummary } from './dashboardTabTypes';
import type { UsedGearWorkflowPostPublishBucket, UsedGearWorkflowPostPublishOwnerFilter } from '@/services/usedGearWorkflowLifecycle';
import type { UsedGearWorkflowAnalyticsSnapshotState } from '@/hooks/useUsedGearWorkflowAnalyticsSnapshot';
import type { UserRole } from '@/stores/auth/authTypes';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

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

function getPostPublishTargetLabel(bucket: UsedGearWorkflowPostPublishBucket, ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter): string {
  const bucketLabel = bucket === 'sold-ready'
    ? 'Sold Ready To Ship'
    : bucket === 'stale-listing'
      ? 'Stale Listings'
      : bucket === 'active-listing'
        ? 'Active Listings'
        : 'Shipped History';

  if (ownerFilter === 'unassigned') {
    return `Unassigned ${bucketLabel}`;
  }

  if (ownerFilter === 'mine') {
    return `My ${bucketLabel}`;
  }

  return bucketLabel;
}

function canSeeRoleDashboardModule(currentUserRole: UserRole, role: 'processor' | 'tester' | 'photographer'): boolean {
  return currentUserRole === role || currentUserRole === 'admin' || currentUserRole === 'owner';
}

interface DashboardOverviewSectionProps {
  accessiblePages: AppPage[];
  canViewSensitiveMetrics: boolean;
  currentUserRole: UserRole;
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
  jfLoading: boolean;
  jotformUnavailableReason?: string | null;
  jfSubmissionCount: number;
  thisWeekCount: number;
  recentCount: number;
  totalNewSubmissions: number;
  spLoading: boolean;
  draftCount: number;
  activeCount: number;
  archivedCount: number;
  nonEmptyListingCount: number;
  approvalPending: number;
  approvalApproved: number;
  approvalTotal: number;
  approvalUnavailableReason?: string | null;
  uniqueAirtableBrands: number;
  uniqueAirtableTypes: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
  ebayTotal: number;
  ebayUnavailableReason?: string | null;
  acquisitionCost: number;
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
    accessiblePages,
    canViewSensitiveMetrics,
    currentUserRole,
    workflowAnalytics,
    jotformUnavailableReason,
    jfSubmissionCount,
    thisWeekCount,
    recentCount,
    totalNewSubmissions,
    spLoading,
    draftCount,
    activeCount,
    archivedCount,
    nonEmptyListingCount,
    approvalPending,
    approvalApproved,
    approvalTotal,
    approvalUnavailableReason,
    uniqueAirtableBrands,
    uniqueAirtableTypes,
    ebayPublishedCount,
    ebayDraftCount,
    ebayTotal,
    ebayUnavailableReason,
    acquisitionCost,
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
  const ebayCoveragePct = ebayTotal > 0 ? Math.round(((ebayPublishedCount + ebayDraftCount) / ebayTotal) * 100) : null;
  const workflowUnavailableReason = workflowAnalytics.error;
  const workflowIntakeCount = workflowAnalytics.pendingReviewCount
    + workflowAnalytics.statusCounts['Accepted - Awaiting Arrival']
    + workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting SKU']
    + workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting Missing Item']
    + workflowAnalytics.statusCounts['Awaiting Pre-Listing Review'];
  const sharedStageCount = workflowAnalytics.statusCounts['Testing and Photography In Progress'];
  const preListingCount = workflowAnalytics.statusCounts['Awaiting Pre-Listing Review'];
  const progressAlertCount = workflowAnalytics.age.progressAlertCount;
  const awaitingArrivalCount = workflowAnalytics.statusCounts['Accepted - Awaiting Arrival'];
  const awaitingSkuCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting SKU'];
  const awaitingMissingCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting Missing Item'];
  const processorBlockerCount = awaitingSkuCount + awaitingMissingCount;

  const cards = [
    canViewSensitiveMetrics ? (
      <DashboardKpiCard
        key="inventory-value"
        borderToneClass="border-t-fuchsia-500"
        eyebrow="Total Inventory Value"
        value={formatCurrency(inventoryValue)}
        detail={<><strong className="font-semibold text-[var(--accent)]">{formatCurrency(avgAskPrice)}</strong> average active ask &nbsp;·&nbsp; valuation snapshot</>}
        trend={inventoryTrend.text}
        trendClass={trendToneClass[inventoryTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />
    ) : null,
    canViewSensitiveMetrics ? (
      <DashboardKpiCard
        key="acquisition-cost"
        borderToneClass="border-t-rose-500"
        eyebrow="Acquisition Cost"
        value={formatCurrency(acquisitionCost)}
        detail={<><strong className="font-semibold text-[var(--accent)]">{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</strong> gross margin &nbsp;·&nbsp; cost basis snapshot</>}
        trend={acquisitionTrend.text}
        trendClass={trendToneClass[acquisitionTrend.direction]}
        onClick={() => onSelectTab('inventory')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('incoming-gear') ? (
      <DashboardKpiCard
        key="processor-ops"
        borderToneClass="border-t-cyan-500"
        eyebrow="Processor Ops"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : workflowIntakeCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{workflowAnalytics.pendingReviewCount}</strong> pending review &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready for pre-listing</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging across intake and stage work` : `${awaitingArrivalCount} awaiting arrival`}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : trendToneClass[inventoryTrend.direction]}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('incoming-gear')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('pre-listing-queue') ? (
      <DashboardKpiCard
        key="processor-blockers"
        borderToneClass="border-t-indigo-500"
        eyebrow="Processing Blockers"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : processorBlockerCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{awaitingSkuCount}</strong> awaiting SKU &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{awaitingMissingCount}</strong> awaiting missing item</>}
        trend={workflowUnavailableReason ? 'Unavailable' : processorBlockerCount > 0 ? `${processorBlockerCount} intake blocker${processorBlockerCount === 1 ? '' : 's'} to clear` : `${preListingCount} cleared for pre-listing`}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : processorBlockerCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('pre-listing-queue')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'tester') && accessiblePages.includes('testing-queue') ? (
      <DashboardKpiCard
        key="testing-queue"
        borderToneClass="border-t-sky-500"
        eyebrow="Testing Queue"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : sharedStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> in the shared testing/photo stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging beyond SLA</>}
        trend={workflowUnavailableReason ? 'Unavailable' : preListingCount > 0 ? `${preListingCount} ready for pre-listing handoff` : sharedStageCount > 0 ? 'Bench queue active' : 'Queue clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : sharedStageCount > 0 ? 'text-blue-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing-queue')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'tester') && accessiblePages.includes('testing') ? (
      <DashboardKpiCard
        key="testing-aging"
        borderToneClass="border-t-blue-600"
        eyebrow="Bench Aging"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : progressAlertCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> active in the shared stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready for handoff</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? 'Testing follow-up needed' : 'Bench flow on pace'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'photographer') && accessiblePages.includes('photography-queue') ? (
      <DashboardKpiCard
        key="photography-queue"
        borderToneClass="border-t-orange-500"
        eyebrow="Photography Queue"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : sharedStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> in the shared testing/photo stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready for listing handoff</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging beyond SLA` : sharedStageCount > 0 ? 'Capture queue active' : 'Queue clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : sharedStageCount > 0 ? 'text-orange-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photography-queue')}
      />
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'photographer') && accessiblePages.includes('photos') ? (
      <DashboardKpiCard
        key="photo-handoffs"
        borderToneClass="border-t-amber-600"
        eyebrow="Photo Handoffs"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : preListingCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> still in the shared stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging beyond SLA</>}
        trend={workflowUnavailableReason ? 'Unavailable' : preListingCount > 0 ? `${preListingCount} ready for pre-listing review` : 'Awaiting complete photo sets'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : preListingCount > 0 ? 'text-orange-300' : 'text-[var(--muted)]'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photos')}
      />
    ) : null,
    accessiblePages.includes('jotform') ? (
      <DashboardKpiCard
        key="jotform"
        borderToneClass="border-t-blue-500"
        eyebrow="Incoming Gear Submissions"
        value={jotformUnavailableReason ? 'Off' : jfLoading ? '…' : jfSubmissionCount.toLocaleString()}
        detail={jotformUnavailableReason ? jotformUnavailableReason : <><strong className="font-semibold text-[var(--accent)]">{thisWeekCount}</strong> this week &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{recentCount}</strong> last 30 days{totalNewSubmissions > 0 && <><span>&nbsp;·&nbsp;</span><span className="font-semibold text-red-600">{totalNewSubmissions} unread</span></>}</>}
        trend={jotformUnavailableReason ? 'Unavailable' : submissionsTrend.text}
        trendClass={jotformUnavailableReason ? 'text-amber-300' : trendToneClass[submissionsTrend.direction]}
        unavailableReason={jotformUnavailableReason}
        onClick={() => onSelectTab('jotform')}
      />
    ) : null,
    accessiblePages.includes('shopify') ? (
      <DashboardKpiCard
        key="shopify"
        borderToneClass="border-t-amber-500"
        eyebrow="Deals in Progress"
        value={spLoading ? '…' : draftCount}
        detail={<><strong className="font-semibold text-[var(--accent)]">{activeCount}</strong> live inventory &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> closed out</>}
        trend={dealsTrend.text}
        trendClass={trendToneClass[dealsTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />
    ) : null,
    accessiblePages.includes('listings') ? (
      <DashboardKpiCard
        key="listings"
        borderToneClass="border-t-violet-500"
        eyebrow="Listings Review"
        value={approvalUnavailableReason ? 'Off' : approvalPending.toLocaleString()}
        detail={approvalUnavailableReason ? approvalUnavailableReason : <><strong className="font-semibold text-[var(--accent)]">{approvalApproved}</strong> approved &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{approvalTotal}</strong> total records</>}
        trend={approvalUnavailableReason ? 'Unavailable' : acquisitionTrend.text}
        trendClass={approvalUnavailableReason ? 'text-amber-300' : trendToneClass[acquisitionTrend.direction]}
        unavailableReason={approvalUnavailableReason}
        onClick={() => onSelectTab('listings')}
      />
    ) : null,
    accessiblePages.includes('inventory') ? (
      <DashboardKpiCard
        key="inventory"
        borderToneClass="border-t-emerald-500"
        eyebrow="Catalog Breadth"
        value={nonEmptyListingCount.toLocaleString()}
        detail={<><strong className="font-semibold text-[var(--accent)]">{uniqueAirtableBrands}</strong> brands &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{uniqueAirtableTypes}</strong> component types</>}
        trend={inventoryTrend.text}
        trendClass={trendToneClass[inventoryTrend.direction]}
        onClick={() => onSelectTab('inventory')}
      />
    ) : null,
    accessiblePages.includes('shopify') ? (
      <DashboardKpiCard
        key="sales"
        borderToneClass="border-t-slate-600"
        eyebrow="Sales Performance"
        value={sellThroughPct !== null ? `${sellThroughPct}%` : '—'}
        detail={<><strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> sold or archived &nbsp;·&nbsp; sell-through rate</>}
        trend={salesTrend.text}
        trendClass={trendToneClass[salesTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />
    ) : null,
    (accessiblePages.includes('ebay') || accessiblePages.includes('listings')) ? (
      <DashboardKpiCard
        key="ebay"
        borderToneClass="border-t-teal-500"
        eyebrow="eBay Coverage"
        value={ebayUnavailableReason ? 'Off' : ebayCoveragePct !== null ? `${ebayCoveragePct}%` : '—'}
        detail={ebayUnavailableReason ? ebayUnavailableReason : <><strong className="font-semibold text-[var(--accent)]">{ebayPublishedCount}</strong> live &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{ebayDraftCount}</strong> draft across {ebayTotal} tracked SKU</>}
        trend={ebayUnavailableReason ? 'Unavailable' : marginTrend.text}
        trendClass={ebayUnavailableReason ? 'text-amber-300' : trendToneClass[marginTrend.direction]}
        unavailableReason={ebayUnavailableReason}
        onClick={() => onSelectTab('ebay')}
      />
    ) : null,
  ].filter(Boolean);

  if (cards.length === 0) {
    return null;
  }

  const content = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards}
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
  onOpenInventoryPostPublishBucket,
  embedded,
}: {
  insights: DashboardInsight[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket, ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter) => void;
  embedded?: boolean;
}) {
  const content = insights.length > 0 ? (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {insights.map((insight) => (
        <article key={insight.id} className={`rounded-xl border px-4 py-3 ${insightToneClass[insight.severity]}`}>
          {(() => {
            const targetTab = insight.targetTab;

            return (
              <>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="m-0 text-[0.86rem] font-bold">{insight.title}</h3>
            <span className={`rounded-full px-2 py-[0.15rem] text-[0.64rem] font-bold uppercase tracking-[0.07em] ${insightBadgeClass[insight.severity]}`}>{insight.severity}</span>
          </div>
          <p className="m-0 text-[0.8rem] leading-[1.45] opacity-90">{insight.detail}</p>
          {targetTab ? (
            <>
              {targetTab === 'inventory' && insight.inventoryPostPublishBucket ? (
                <span className="mt-3 inline-flex rounded-full border border-current/30 bg-white/10 px-2.5 py-0.5 text-[0.64rem] font-bold uppercase tracking-[0.07em]">
                  Opens {getPostPublishTargetLabel(insight.inventoryPostPublishBucket, insight.inventoryPostPublishOwnerFilter)} Bucket
                </span>
              ) : null}
              <button
                type="button"
                className="mt-3 rounded-lg border border-current/30 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold transition hover:bg-white/20"
                onClick={() => {
                  if (targetTab === 'inventory' && insight.inventoryPostPublishBucket) {
                    onOpenInventoryPostPublishBucket(insight.inventoryPostPublishBucket, insight.inventoryPostPublishOwnerFilter);
                    return;
                  }

                  onSelectTab(targetTab);
                }}
              >
                Review in {PAGE_DEFINITIONS[targetTab].label} →
              </button>
            </>
          ) : null}
              </>
            );
          })()}
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
