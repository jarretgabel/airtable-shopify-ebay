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
  if (role === 'processor') {
    return currentUserRole === 'processor' || currentUserRole === 'admin' || currentUserRole === 'owner';
  }

  return currentUserRole === role;
}

interface DashboardOverviewSectionProps {
  accessiblePages: AppPage[];
  canViewSensitiveMetrics?: boolean;
  currentUserRole: UserRole;
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
  spLoading?: boolean;
  draftCount?: number;
  activeCount?: number;
  archivedCount?: number;
  nonEmptyListingCount?: number;
  approvalPending?: number;
  approvalApproved?: number;
  approvalTotal?: number;
  approvalUnavailableReason?: string | null;
  uniqueAirtableBrands?: number;
  uniqueAirtableTypes?: number;
  ebayPublishedCount?: number;
  ebayDraftCount?: number;
  ebayTotal?: number;
  ebayUnavailableReason?: string | null;
  acquisitionCost?: number;
  inventoryValue?: number;
  avgAskPrice?: number;
  sellThroughPct?: number | null;
  grossMarginPct?: number | null;
  dealsTrend?: TrendSummary;
  acquisitionTrend?: TrendSummary;
  inventoryTrend?: TrendSummary;
  salesTrend?: TrendSummary;
  marginTrend?: TrendSummary;
  onSelectTab: (tab: DashboardTargetTab) => void;
  embedded?: boolean;
}

export function DashboardOverviewSection(props: DashboardOverviewSectionProps) {
  const {
    accessiblePages,
    currentUserRole,
    workflowAnalytics,
    onSelectTab,
    embedded,
  } = props;
  const workflowUnavailableReason = workflowAnalytics.error;
  const testingStageCount = workflowAnalytics.statusCounts['Testing In Progress'] ?? 0;
  const photographyStageCount = workflowAnalytics.statusCounts['Photography In Progress'] ?? 0;
  const downstreamStageCount = testingStageCount + photographyStageCount;
  const workflowIntakeCount = workflowAnalytics.pendingReviewCount
    + workflowAnalytics.statusCounts['Accepted - Awaiting Arrival']
    + workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting SKU']
    + workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting Missing Item']
    + downstreamStageCount;
  const preListingCount = workflowAnalytics.statusCounts['Awaiting Pre-Listing Review'];
  const approvedForPublishCount = workflowAnalytics.statusCounts['Approved for Publish'];
  const listingPhaseCount = preListingCount + approvedForPublishCount;
  const progressAlertCount = workflowAnalytics.age.progressAlertCount;
  const awaitingArrivalCount = workflowAnalytics.statusCounts['Accepted - Awaiting Arrival'];
  const awaitingSkuCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting SKU'];
  const awaitingMissingCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting Missing Item'];
  const processorBlockerCount = awaitingSkuCount + awaitingMissingCount;

  const cards: Array<OverviewCardEntry | null> = [
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('manual-intake') ? (
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
          : <><strong className="font-semibold text-[var(--accent)]">{workflowAnalytics.pendingReviewCount}</strong> pending &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{downstreamStageCount}</strong> in testing or photos</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging` : `${awaitingArrivalCount} awaiting arrival`}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('manual-intake')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'processor') && accessiblePages.includes('inventory') ? (
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
        onClick={() => onSelectTab('inventory')}
      />,
      }
    ) : null,
    accessiblePages.includes('listings') ? (
      {
        key: 'workflow-listings',
        priority: 25,
        element: <DashboardKpiCard
        key="workflow-listings"
        borderToneClass="border-t-violet-500"
        eyebrow="Used Gear Listings"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : listingPhaseCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{preListingCount}</strong> pre-listing &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{approvedForPublishCount}</strong> approved</>}
        trend={workflowUnavailableReason ? 'Unavailable' : preListingCount > 0 ? `${preListingCount} awaiting review` : approvedForPublishCount > 0 ? `${approvedForPublishCount} ready to list` : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : listingPhaseCount > 0 ? 'text-violet-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('listings')}
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
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : testingStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{testingStageCount}</strong> waiting on testing &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging` : testingStageCount > 0 ? 'Active' : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : testingStageCount > 0 ? 'text-blue-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing-queue')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'tester') && accessiblePages.includes('testing-queue') ? (
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
          : <><strong className="font-semibold text-[var(--accent)]">{testingStageCount}</strong> waiting on testing &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{awaitingSkuCount + awaitingMissingCount}</strong> blocked in processing</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? 'Follow up needed' : 'On pace'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-amber-400' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('testing-queue')}
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
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : photographyStageCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{photographyStageCount}</strong> waiting on photos &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{progressAlertCount}</strong> aging</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? `${progressAlertCount} aging` : photographyStageCount > 0 ? 'Active' : 'Clear'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : photographyStageCount > 0 ? 'text-orange-300' : 'text-emerald-300'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photography-queue')}
      />,
      }
    ) : null,
    canSeeRoleDashboardModule(currentUserRole, 'photographer') && accessiblePages.includes('photography-queue') ? (
      {
        key: 'photo-aging',
        priority: 20,
        element: <DashboardKpiCard
        key="photo-aging"
        borderToneClass="border-t-amber-600"
        eyebrow="Photo Bench Aging"
        value={workflowUnavailableReason ? 'Off' : workflowAnalytics.loading ? '…' : progressAlertCount.toLocaleString()}
        detail={workflowUnavailableReason
          ? workflowUnavailableReason
          : <><strong className="font-semibold text-[var(--accent)]">{photographyStageCount}</strong> waiting on photos &nbsp;·&nbsp; <strong className="font-semibold text-[var(--accent)]">{approvedForPublishCount}</strong> already in Listings</>}
        trend={workflowUnavailableReason ? 'Unavailable' : progressAlertCount > 0 ? 'Follow up needed' : 'Waiting on photo sets'}
        trendClass={workflowUnavailableReason ? 'text-amber-300' : progressAlertCount > 0 ? 'text-orange-300' : 'text-[var(--muted)]'}
        unavailableReason={workflowUnavailableReason}
        onClick={() => onSelectTab('photography-queue')}
      />,
      }
    ) : null,
  ];

  const orderedCards = cards
    .filter((card): card is OverviewCardEntry => card !== null)
    .sort((left, right) => left.priority - right.priority);

  if (orderedCards.length === 0) {
    return null;
  }

  const content = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {orderedCards.map((card) => card.element)}
    </div>
  );

  if (embedded) {
    return content;
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
        <article key={insight.id} className={`flex h-full flex-col rounded-xl border px-4 py-3 ${insightToneClass[insight.severity]}`}>
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
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="self-start rounded-lg border border-current/30 bg-white/10 px-3 py-1.5 text-[0.72rem] font-semibold transition hover:bg-white/20"
                onClick={() => {
                  if (insight.inventoryPostPublishBucket) {
                    onOpenInventoryPostPublishBucket(insight.inventoryPostPublishBucket);
                    return;
                  }

                  onSelectTab(targetTab);
                }}
              >
                {insight.inventoryPostPublishBucket
                  ? `Open ${getPostPublishTargetLabel(insight.inventoryPostPublishBucket)}`
                  : `Open ${getInsightTargetLabel(targetTab)}`}
              </button>
            </div>
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
