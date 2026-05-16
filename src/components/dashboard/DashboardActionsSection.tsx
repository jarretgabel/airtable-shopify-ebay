import type { AppPage } from '@/auth/pages';
import type { DashboardTargetTab } from './dashboardTabTypes';
import type { UsedGearWorkflowPostPublishBucket } from '@/services/usedGearWorkflowLifecycle';
import type { UsedGearWorkflowAnalyticsSnapshotState } from '@/hooks/useUsedGearWorkflowAnalyticsSnapshot';
import type { UserRole } from '@/stores/auth/authTypes';
import { DashboardSubPanel } from './dashboardPrimitives';

const severityClass = {
  critical: 'border-red-500/30 bg-red-950/25 text-red-300 hover:border-red-400/50',
  warning: 'border-amber-500/30 bg-amber-950/25 text-amber-300 hover:border-amber-400/50',
} as const;

const severityCountClass = {
  critical: 'bg-red-900/50 text-red-200',
  warning: 'bg-amber-900/50 text-amber-200',
} as const;

interface ActionItem {
  key: string;
  label: string;
  count: number;
  detail: string;
  severity: 'critical' | 'warning';
  targetTab: DashboardTargetTab;
  inventoryWorkflowView?: 'pending-review' | 'progress';
  inventoryWorkflowFocusedGroupId?: string | null;
  inventoryPostPublishBucket?: UsedGearWorkflowPostPublishBucket;
  unavailable?: boolean;
}

function addOverdueWorkflowActionItems({
  canAccessInventory,
  items,
  workflowAnalytics,
  pendingReviewOldestGroupId,
  pendingReviewOldestGroupLabel,
  progressOldestGroupId,
  progressOldestGroupLabel,
}: {
  canAccessInventory: boolean;
  items: ActionItem[];
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
  pendingReviewOldestGroupId: string | null;
  pendingReviewOldestGroupLabel: string | null;
  progressOldestGroupId: string | null;
  progressOldestGroupLabel: string | null;
}) {
  if (!canAccessInventory || workflowAnalytics.loading || workflowAnalytics.error) {
    return;
  }

  if (workflowAnalytics.pendingReviewCount > 0 && workflowAnalytics.age.oldestPendingReviewAgeDays !== null && pendingReviewOldestGroupId) {
    items.push({
      key: 'workflow-pending-review-oldest',
      label: `${workflowAnalytics.age.oldestPendingReviewAgeDays}d oldest pending review`,
      count: workflowAnalytics.pendingReviewCount,
      detail: `${pendingReviewOldestGroupLabel ?? pendingReviewOldestGroupId}`,
      severity: workflowAnalytics.age.pendingReviewAlertCount > 0 ? 'critical' : 'warning',
      targetTab: 'inventory',
      inventoryWorkflowView: 'pending-review',
      inventoryWorkflowFocusedGroupId: pendingReviewOldestGroupId,
    });
  }

  if (workflowAnalytics.progressCount > 0 && workflowAnalytics.age.oldestProgressAgeDays !== null && progressOldestGroupId) {
    items.push({
      key: 'workflow-progress-oldest',
      label: `${workflowAnalytics.age.oldestProgressAgeDays}d oldest in progress`,
      count: workflowAnalytics.progressCount,
      detail: `${progressOldestGroupLabel ?? progressOldestGroupId}`,
      severity: workflowAnalytics.age.progressAlertCount > 0 ? 'critical' : 'warning',
      targetTab: 'inventory',
      inventoryWorkflowView: 'progress',
      inventoryWorkflowFocusedGroupId: progressOldestGroupId,
    });
  }
}

function addRoleWorkflowActionItems({
  accessiblePages,
  currentUserRole,
  workflowAnalytics,
  items,
}: {
  accessiblePages: AppPage[];
  currentUserRole: UserRole;
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
  items: ActionItem[];
}) {
  if (workflowAnalytics.loading || workflowAnalytics.error) {
    return;
  }

  const awaitingSkuCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting SKU'];
  const awaitingMissingCount = workflowAnalytics.statusCounts['Accepted - Arrived, Awaiting Missing Item'];
  const sharedStageCount = workflowAnalytics.statusCounts['Testing and Photography In Progress'];
  const preListingCount = workflowAnalytics.statusCounts['Awaiting Pre-Listing Review'];
  const approvedForPublishCount = workflowAnalytics.statusCounts['Approved for Publish'];
  const pendingReviewCount = workflowAnalytics.pendingReviewCount;
  const progressAlertCount = workflowAnalytics.age.progressAlertCount;
  const processingBlockerCount = awaitingSkuCount + awaitingMissingCount;

  if (currentUserRole === 'processor') {
    if (accessiblePages.includes('parking-lot-1') && pendingReviewCount > 0) {
      items.push({
        key: 'workflow-pending-review',
        label: `${pendingReviewCount} pending review`,
        count: pendingReviewCount,
        detail: `${processingBlockerCount} blocked in processing · ${sharedStageCount} in shared stage`,
        severity: 'critical',
        targetTab: 'parking-lot-1',
      });
    }

    if (accessiblePages.includes('inventory') && processingBlockerCount > 0) {
      items.push({
        key: 'workflow-processing-blockers',
        label: `${processingBlockerCount} processing blocker${processingBlockerCount === 1 ? '' : 's'}`,
        count: processingBlockerCount,
        detail: `${awaitingSkuCount} awaiting SKU · ${awaitingMissingCount} missing item`,
        severity: 'warning',
        targetTab: 'inventory',
      });
    }

    if (accessiblePages.includes('listings') && (preListingCount > 0 || approvedForPublishCount > 0)) {
      const listingPhaseCount = preListingCount + approvedForPublishCount;
      items.push({
        key: 'workflow-listings-phase',
        label: `${listingPhaseCount} listing-phase row${listingPhaseCount === 1 ? '' : 's'}`,
        count: listingPhaseCount,
        detail: `${preListingCount} pre-listing review · ${approvedForPublishCount} approved for publish`,
        severity: preListingCount > 0 ? 'critical' : 'warning',
        targetTab: 'listings',
      });
    }

    return;
  }

  if (currentUserRole === 'tester') {
    if (accessiblePages.includes('testing-queue') && sharedStageCount > 0) {
      items.push({
        key: 'workflow-testing-queue',
        label: `${sharedStageCount} in testing queue`,
        count: sharedStageCount,
        detail: `${progressAlertCount} aging · ${sharedStageCount} active in stage`,
        severity: progressAlertCount > 0 ? 'critical' : 'warning',
        targetTab: 'testing-queue',
      });
    }

    if (accessiblePages.includes('testing-queue') && progressAlertCount > 0) {
      items.push({
        key: 'workflow-testing-aging',
        label: `${progressAlertCount} testing item${progressAlertCount === 1 ? '' : 's'} aging`,
        count: progressAlertCount,
        detail: `${sharedStageCount} active in stage`,
        severity: 'warning',
        targetTab: 'testing-queue',
      });
    }
    return;
  }

  if (currentUserRole === 'photographer') {
    if (accessiblePages.includes('photography-queue') && sharedStageCount > 0) {
      items.push({
        key: 'workflow-photography-queue',
        label: `${sharedStageCount} waiting on photos`,
        count: sharedStageCount,
        detail: `${progressAlertCount} aging · ${sharedStageCount} active in stage`,
        severity: progressAlertCount > 0 ? 'critical' : 'warning',
        targetTab: 'photography-queue',
      });
    }

    if (accessiblePages.includes('photography-queue') && progressAlertCount > 0) {
      items.push({
        key: 'workflow-photo-aging',
        label: `${progressAlertCount} photo item${progressAlertCount === 1 ? '' : 's'} aging`,
        count: progressAlertCount,
        detail: `${sharedStageCount} active in stage`,
        severity: 'warning',
        targetTab: 'photography-queue',
      });
    }

    return;
  }
}

function ActionButton({
  item,
  onSelectTab,
  onOpenInventoryWorkflowView,
  onOpenInventoryPostPublishBucket,
}: {
  item: ActionItem;
  onSelectTab: (tab: DashboardTargetTab) => void;
  onOpenInventoryWorkflowView: (
    view: 'pending-review' | 'progress',
    options?: { focusedGroupId?: string | null },
  ) => void;
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket) => void;
}) {
  return (
    <button
      type="button"
      className={[
        'flex w-full items-start gap-3 rounded-[12px] border px-4 py-3.5 text-left transition',
        severityClass[item.severity],
        item.unavailable ? 'cursor-not-allowed opacity-80 hover:translate-y-0' : 'hover:-translate-y-px',
      ].join(' ')}
      disabled={item.unavailable}
      title={item.unavailable ? item.detail : undefined}
      onClick={() => {
        if (!item.unavailable) {
          if (item.targetTab === 'inventory' && item.inventoryWorkflowView) {
            onOpenInventoryWorkflowView(item.inventoryWorkflowView, {
              focusedGroupId: item.inventoryWorkflowFocusedGroupId,
            });
            return;
          }
          if (item.targetTab === 'inventory' && item.inventoryPostPublishBucket) {
            onOpenInventoryPostPublishBucket(item.inventoryPostPublishBucket);
            return;
          }
          onSelectTab(item.targetTab);
        }
      }}
    >
      <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold tabular-nums ${severityCountClass[item.severity]}`}>
        {item.unavailable ? 'Off' : item.count}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.88rem] font-semibold leading-snug">{item.label}</span>
        <span className="text-[0.78rem] opacity-75">{item.detail}</span>
      </div>
      <span className="ml-auto shrink-0 self-center text-[0.75rem] font-semibold opacity-60">{item.unavailable ? 'Unavailable' : 'Open'}</span>
    </button>
  );
}

export interface DashboardActionsSectionProps {
  accessiblePages: AppPage[];
  currentUserRole: UserRole;
  currentUserName: string;
  ebayAuthenticated: boolean;
  ebayDraftCount: number;
  ebayPublishedCount: number;
  ebayTotal: number;
  shopifyQueueApproved: number;
  shopifyQueuePending: number;
  shopifyQueueTotal: number;
  workflowPostPublishLoading: boolean;
  workflowAnalytics: UsedGearWorkflowAnalyticsSnapshotState;
  workflowActiveListingCount: number;
  workflowStaleListingCount: number;
  workflowStaleListingMineCount: number;
  workflowStaleListingUnassignedCount: number;
  workflowSoldReadyCount: number;
  workflowSoldReadyMineCount: number;
  workflowSoldReadyUnassignedCount: number;
  workflowShippedCount: number;
  workflowPendingReviewOldestGroupId: string | null;
  workflowPendingReviewOldestGroupLabel: string | null;
  workflowProgressOldestGroupId: string | null;
  workflowProgressOldestGroupLabel: string | null;
  ebayUnavailableReason?: string | null;
  shopifyApprovalUnavailableReason?: string | null;
  onSelectTab: (tab: DashboardTargetTab) => void;
  onOpenInventoryWorkflowView: (
    view: 'pending-review' | 'progress',
    options?: { focusedGroupId?: string | null },
  ) => void;
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket) => void;
  embedded?: boolean;
}

export function DashboardActionsSection({
  accessiblePages,
  currentUserRole,
  ebayAuthenticated,
  ebayDraftCount,
  ebayPublishedCount,
  ebayTotal,
  shopifyQueueApproved,
  shopifyQueuePending,
  shopifyQueueTotal,
  workflowPostPublishLoading,
  workflowAnalytics,
  workflowActiveListingCount,
  workflowStaleListingCount,
  workflowSoldReadyCount,
  workflowShippedCount,
  workflowPendingReviewOldestGroupId,
  workflowPendingReviewOldestGroupLabel,
  workflowProgressOldestGroupId,
  workflowProgressOldestGroupLabel,
  ebayUnavailableReason,
  shopifyApprovalUnavailableReason,
  onSelectTab,
  onOpenInventoryWorkflowView,
  onOpenInventoryPostPublishBucket,
  embedded,
}: DashboardActionsSectionProps) {
  const items: ActionItem[] = [];
  const canAccessListings = accessiblePages.includes('listings');
  const canAccessInventory = accessiblePages.includes('inventory');
  const canAccessEbay = accessiblePages.includes('ebay');

  addOverdueWorkflowActionItems({
    canAccessInventory,
    items,
    workflowAnalytics,
    pendingReviewOldestGroupId: workflowPendingReviewOldestGroupId,
    pendingReviewOldestGroupLabel: workflowPendingReviewOldestGroupLabel,
    progressOldestGroupId: workflowProgressOldestGroupId,
    progressOldestGroupLabel: workflowProgressOldestGroupLabel,
  });

  addRoleWorkflowActionItems({
    accessiblePages,
    currentUserRole,
    workflowAnalytics,
    items,
  });

  if (canAccessListings && shopifyApprovalUnavailableReason) {
    items.push({
      key: 'listings-shopify-unavailable',
      label: 'Shopify review unavailable',
      count: 0,
      detail: shopifyApprovalUnavailableReason,
      severity: 'warning',
      targetTab: 'listings',
      unavailable: true,
    });
  }

  if (canAccessListings && !shopifyApprovalUnavailableReason && shopifyQueuePending > 0) {
    items.push({
      key: 'listings-shopify',
      label: `${shopifyQueuePending} Shopify listing${shopifyQueuePending === 1 ? '' : 's'} to review`,
      count: shopifyQueuePending,
      detail: `${shopifyQueueApproved} approved · ${shopifyQueueTotal} total`,
      severity: 'critical',
      targetTab: 'listings',
    });
  }

  if ((canAccessEbay || canAccessListings) && ebayUnavailableReason) {
    items.push({
      key: 'ebay-unavailable',
      label: 'eBay unavailable',
      count: 0,
      detail: ebayUnavailableReason,
      severity: 'warning',
      targetTab: 'ebay',
      unavailable: true,
    });
  }

  if (canAccessListings && !ebayUnavailableReason && ebayAuthenticated && ebayDraftCount > 0) {
    items.push({
      key: 'ebay',
      label: `${ebayDraftCount} eBay draft${ebayDraftCount === 1 ? '' : 's'} to review`,
      count: ebayDraftCount,
      detail: `${ebayPublishedCount} live · ${ebayTotal} tracked`,
      severity: 'warning',
      targetTab: 'listings',
    });
  }

  if (canAccessInventory && !workflowPostPublishLoading && workflowSoldReadyCount > 0) {
    items.push({
      key: 'used-gear-sold-ready',
      label: `${workflowSoldReadyCount} sold ready to ship`,
      count: workflowSoldReadyCount,
      detail: `${workflowShippedCount} shipped history`,
      severity: 'critical',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'sold-ready',
    });
  }

  if (canAccessInventory && !workflowPostPublishLoading && workflowStaleListingCount > 0) {
    items.push({
      key: 'used-gear-stale',
      label: `${workflowStaleListingCount} stale listing${workflowStaleListingCount === 1 ? '' : 's'}`,
      count: workflowStaleListingCount,
      detail: `${workflowActiveListingCount} active listing${workflowActiveListingCount === 1 ? '' : 's'}`,
      severity: 'warning',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'stale-listing',
    });
  }

  const visibleItems = embedded ? items.slice(0, 4) : items;
  const hiddenItems = embedded ? items.slice(4) : [];

  const content = items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[12px] border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.88rem] text-emerald-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>All clear — no actions required right now.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleItems.map((item) => (
            <ActionButton
              key={item.key}
              item={item}
              onSelectTab={onSelectTab}
              onOpenInventoryWorkflowView={onOpenInventoryWorkflowView}
              onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
            />
          ))}
          {hiddenItems.length > 0 ? (
            <details className="rounded-[12px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_86%,transparent)] px-4 py-3 text-[var(--ink)]">
              <summary className="cursor-pointer list-none text-[0.8rem] font-semibold">
                Show {hiddenItems.length} more action{hiddenItems.length === 1 ? '' : 's'}
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {hiddenItems.map((item) => (
                  <ActionButton
                    key={item.key}
                    item={item}
                    onSelectTab={onSelectTab}
                    onOpenInventoryWorkflowView={onOpenInventoryWorkflowView}
                    onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      );

  if (embedded) {
    return <DashboardSubPanel title="Actions Needed">{content}</DashboardSubPanel>;
  }

  return (
    <section
      id="actions"
      className="scroll-mt-24 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_1px_3px_rgba(17,32,49,0.06),0_4px_14px_rgba(17,32,49,0.05)]"
    >
      <div className="mb-4 flex items-center border-b border-[var(--line)] pb-3 pt-1">
        <h2 className="m-0 text-[1.05rem] font-semibold text-[var(--ink)]">Actions Needed</h2>
      </div>

      {content}
    </section>
  );
}
