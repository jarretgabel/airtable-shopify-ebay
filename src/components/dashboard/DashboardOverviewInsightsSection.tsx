import { PAGE_DEFINITIONS, type AppPage } from '@/auth/pages';
import { DashboardKpiCard, DashboardSectionPanel, DashboardSubPanel } from './dashboardPrimitives';
import type { DashboardInsight, DashboardTargetTab, TrendSummary } from './dashboardTabTypes';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import type { UsedGearWorkflowAnalyticsSnapshotState } from '@/hooks/useUsedGearWorkflowAnalyticsSnapshot';
import type { UserRole } from '@/stores/auth/authTypes';

interface OverviewCardEntry {
  key: string;
  priority: number;
  element: JSX.Element;
}

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

function getInsightTargetLabel(targetTab: DashboardTargetTab): string {
  if (targetTab === 'inventory') {
    return 'Inventory';
  }

  if (targetTab === 'shopify') {
    return 'Shopify';
  }

  return PAGE_DEFINITIONS[targetTab].label;
}

function getPostPublishTargetLabel(bucket: UsedGearWorkflowPostPublishBucket): string {
  return bucket === 'sold-ready'
    ? 'Sold Ready To Ship'
    : bucket === 'stale-listing'
      ? 'Stale Listings'
      : bucket === 'active-listing'
        ? 'Active Listings'
        : 'Shipped History';
}

function canSeeRoleDashboardModule(currentUserRole: UserRole, role: 'processor' | 'tester' | 'photographer'): boolean {
  return currentUserRole === role || currentUserRole === 'admin' || currentUserRole === 'owner';
}

interface DashboardOverviewSectionProps {
  accessiblePages: AppPage[];
  canViewSensitiveMetrics: boolean;
  currentUserRole: UserRole;
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
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
    accessiblePages,
    canViewSensitiveMetrics,
    currentUserRole,
    workflowAnalytics,
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

  const cards: Array<OverviewCardEntry | null> = [
    canViewSensitiveMetrics ? (
      {
        key: 'inventory-value',
        priority: 70,
        element: <DashboardKpiCard
        key="inventory-value"
        borderToneClass="border-t-fuchsia-500"
        eyebrow="Inventory Value"
        value={formatCurrency(inventoryValue)}
        detail={<><strong className="font-semibold text-[var(--accent)]">{formatCurrency(avgAskPrice)}</strong> avg ask</>}
        trend={inventoryTrend.text}
        trendClass={trendToneClass[inventoryTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />,
      }
    ) : null,
    canViewSensitiveMetrics ? (
      {
        key: 'acquisition-cost',
        priority: 80,
        element: <DashboardKpiCard
        key="acquisition-cost"
        borderToneClass="border-t-rose-500"
        eyebrow="Acquisition Cost"
        value={formatCurrency(acquisitionCost)}
        detail={<><strong className="font-semibold text-[var(--accent)]">{grossMarginPct !== null ? `${grossMarginPct}%` : '—'}</strong> gross margin</>}
        trend={acquisitionTrend.text}
        trendClass={trendToneClass[acquisitionTrend.direction]}
        onClick={() => onSelectTab('inventory')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('incoming-gear') ? (
      {
        key: 'processor-ops',
        priority: 10,
        element: <DashboardKpiCard
        key="processor-ops"
        borderToneClass="border-t-cyan-500"
        eyebrow="Processor Ops"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : workflowIntakeCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{workflowAnalytics.pendingReviewCount}</strong> pending &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready next</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging` : `${awaitingArrivalCount} awaiting arrival`}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : trendToneClass[inventoryTrend.direction]}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('incoming-gear')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('pre-listing-queue') ? (
      {
        key: 'processor-blockers',
        priority: 20,
        element: <DashboardKpiCard
        key="processor-blockers"
        borderToneClass="border-t-indigo-500"
        eyebrow="Processing Blockers"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : processorBlockerCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{awaitingSkuCount}</strong> awaiting SKU &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{awaitingMissingCount}</strong> missing item</>}
        trend={workflowUnavailableReason ? 'Unavailable' : processorBlockerCount > 0 ? `${processorBlockerCount} to clear` : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : processorBlockerCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('pre-listing-queue')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'tester') && accessiblePages.includes('testing-queue') ? (
      {
        key: 'testing-queue',
        priority: 10,
        element: <DashboardKpiCard
        key="testing-queue"
        borderToneClass="border-t-sky-500"
        eyebrow="Testing Queue"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : sharedStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> in stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging</>}
        trend={workflowUnavailableReason ? 'Unavailable' : preListingCount > 0 ? `${preListingCount} ready next` : sharedStageCount > 0 ? 'Active' : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : sharedStageCount > 0 ? 'text-blue-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing-queue')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'tester') && accessiblePages.includes('testing') ? (
      {
        key: 'testing-aging',
        priority: 20,
        element: <DashboardKpiCard
        key="testing-aging"
        borderToneClass="border-t-blue-600"
        eyebrow="Bench Aging"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : progressAlertCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> in stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready next</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? 'Follow up needed' : 'On pace'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'photographer') && accessiblePages.includes('photography-queue') ? (
      {
        key: 'photography-queue',
        priority: 10,
        element: <DashboardKpiCard
        key="photography-queue"
        borderToneClass="border-t-orange-500"
        eyebrow="Photography Queue"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : sharedStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> in stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> ready next</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging` : sharedStageCount > 0 ? 'Active' : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : sharedStageCount > 0 ? 'text-orange-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photography-queue')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'photographer') && accessiblePages.includes('photos') ? (
      {
        key: 'photo-handoffs',
        priority: 20,
        element: <DashboardKpiCard
        key="photo-handoffs"
        borderToneClass="border-t-amber-600"
        eyebrow="Photo Handoffs"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : preListingCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{sharedStageCount}</strong> still in stage &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging</>}
        trend={workflowUnavailableReason ? 'Unavailable' : preListingCount > 0 ? `${preListingCount} ready next` : 'Waiting on photo sets'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : preListingCount > 0 ? 'text-orange-300' : 'text-[var(--muted)]'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photos')}
      />,
      }
    ) : null,
    accessiblePages.includes('shopify') ? (
      {
        key: 'shopify',
        priority: 40,
        element: <DashboardKpiCard
        key="shopify"
        borderToneClass="border-t-amber-500"
        eyebrow="Shopify Drafts"
        value={spLoading ? '…' : draftCount}
        detail={<><strong className="font-semibold text-[var(--accent)]">{activeCount}</strong> live &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> archived</>}
        trend={dealsTrend.text}
        trendClass={trendToneClass[dealsTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />,
      }
    ) : null,
    accessiblePages.includes('listings') ? (
      {
        key: 'listings',
        priority: 30,
        element: <DashboardKpiCard
        key="listings"
        borderToneClass="border-t-violet-500"
        eyebrow="Listings Review"
        value={approvalUnavailableReason ? 'Off' : approvalPending.toLocaleString()}
        detail={approvalUnavailableReason ? approvalUnavailableReason : <><strong className="font-semibold text-[var(--accent)]">{approvalApproved}</strong> approved &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{approvalTotal}</strong> total</>}
        trend={approvalUnavailableReason ? 'Unavailable' : acquisitionTrend.text}
        trendClass={approvalUnavailableReason ? 'text-amber-300' : trendToneClass[acquisitionTrend.direction]}
        unavailableReason={approvalUnavailableReason}
        onClick={() => onSelectTab('listings')}
      />,
      }
    ) : null,
    accessiblePages.includes('inventory') ? (
      {
        key: 'inventory',
        priority: 50,
        element: <DashboardKpiCard
        key="inventory"
        borderToneClass="border-t-emerald-500"
        eyebrow="Inventory"
        value={nonEmptyListingCount.toLocaleString()}
        detail={<><strong className="font-semibold text-[var(--accent)]">{uniqueAirtableBrands}</strong> brands &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{uniqueAirtableTypes}</strong> types</>}
        trend={inventoryTrend.text}
        trendClass={trendToneClass[inventoryTrend.direction]}
        onClick={() => onSelectTab('inventory')}
      />,
      }
    ) : null,
    accessiblePages.includes('shopify') ? (
      {
        key: 'sales',
        priority: 60,
        element: <DashboardKpiCard
        key="sales"
        borderToneClass="border-t-slate-600"
        eyebrow="Sell-Through"
        value={sellThroughPct !== null ? `${sellThroughPct}%` : '—'}
        detail={<><strong className="font-semibold text-[var(--accent)]">{archivedCount}</strong> sold or archived</>}
        trend={salesTrend.text}
        trendClass={trendToneClass[salesTrend.direction]}
        onClick={() => onSelectTab('shopify')}
      />,
      }
    ) : null,
    (accessiblePages.includes('ebay') || accessiblePages.includes('listings')) ? (
      {
        key: 'ebay',
        priority: 55,
        element: <DashboardKpiCard
        key="ebay"
        borderToneClass="border-t-teal-500"
        eyebrow="eBay Coverage"
        value={ebayUnavailableReason ? 'Off' : ebayCoveragePct !== null ? `${ebayCoveragePct}%` : '—'}
        detail={ebayUnavailableReason ? ebayUnavailableReason : <><strong className="font-semibold text-[var(--accent)]">{ebayPublishedCount}</strong> live &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{ebayDraftCount}</strong> draft</>}
        trend={ebayUnavailableReason ? 'Unavailable' : marginTrend.text}
        trendClass={ebayUnavailableReason ? 'text-amber-300' : trendToneClass[marginTrend.direction]}
        unavailableReason={ebayUnavailableReason}
        onClick={() => onSelectTab('ebay')}
      />,
      }
    ) : null,
  ];

  const orderedCards = cards
    .filter((card): card is OverviewCardEntry => card !== null)
    .sort((left, right) => left.priority - right.priority);
  const primaryCards = embedded ? orderedCards.slice(0, 6) : orderedCards;
  const secondaryCards = embedded ? orderedCards.slice(6) : [];

  if (orderedCards.length === 0) {
    return null;
  }

  const content = (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {primaryCards.map((card) => card.element)}
      </div>
      {secondaryCards.length > 0 ? (
        <details className="rounded-[12px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_86%,transparent)] px-4 py-3">
          <summary className="cursor-pointer list-none text-[0.8rem] font-semibold text-[var(--ink)]">
            More metrics
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {secondaryCards.map((card) => card.element)}
          </div>
        </details>
      ) : null}
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
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket) => void;
  embedded?: boolean;
}) {
  const primaryInsights = embedded ? insights.slice(0, 4) : insights;
  const secondaryInsights = embedded ? insights.slice(4) : [];

  const insightCards = (items: DashboardInsight[]) => (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((insight) => (
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
                  Opens {getPostPublishTargetLabel(insight.inventoryPostPublishBucket)} Bucket
                </span>
              ) : null}
              <button
                type="button"
                className="mt-3 rounded-lg border border-current/30 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold transition hover:bg-white/20"
                onClick={() => {
                  if (targetTab === 'inventory' && insight.inventoryPostPublishBucket) {
                    onOpenInventoryPostPublishBucket(insight.inventoryPostPublishBucket);
                    return;
                  }

                  onSelectTab(targetTab);
                }}
              >
                Open {getInsightTargetLabel(targetTab)}
              </button>
            </>
          ) : null}
              </>
            );
          })()}
        </article>
      ))}
    </div>
  );

  const content = insights.length > 0 ? (
    <div className="flex flex-col gap-3">
      {insightCards(primaryInsights)}
      {secondaryInsights.length > 0 ? (
        <details className="rounded-[12px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_86%,transparent)] px-4 py-3">
          <summary className="cursor-pointer list-none text-[0.8rem] font-semibold text-[var(--ink)]">
            Show {secondaryInsights.length} more insight{secondaryInsights.length === 1 ? '' : 's'}
          </summary>
          <div className="mt-3">{insightCards(secondaryInsights)}</div>
        </details>
      ) : null}
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
