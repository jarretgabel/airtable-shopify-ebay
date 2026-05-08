import type { DashboardTargetTab } from './dashboardTabTypes';
import type { UsedGearWorkflowPostPublishBucket, UsedGearWorkflowPostPublishOwnerFilter } from '@/services/usedGearWorkflowLifecycle';
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
  inventoryPostPublishBucket?: UsedGearWorkflowPostPublishBucket;
  inventoryPostPublishOwnerFilter?: UsedGearWorkflowPostPublishOwnerFilter;
  unavailable?: boolean;
}

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

function ActionButton({
  item,
  onSelectTab,
  onOpenInventoryPostPublishBucket,
}: {
  item: ActionItem;
  onSelectTab: (tab: DashboardTargetTab) => void;
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket, ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter) => void;
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
          if (item.targetTab === 'inventory' && item.inventoryPostPublishBucket) {
            onOpenInventoryPostPublishBucket(item.inventoryPostPublishBucket, item.inventoryPostPublishOwnerFilter);
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
        {item.inventoryPostPublishBucket ? (
          <span className="mt-2 inline-flex w-fit rounded-full border border-current/25 bg-white/10 px-2.5 py-0.5 text-[0.64rem] font-bold uppercase tracking-[0.07em] opacity-90">
            Opens {getPostPublishTargetLabel(item.inventoryPostPublishBucket, item.inventoryPostPublishOwnerFilter)} Bucket
          </span>
        ) : null}
      </div>
      <span className="ml-auto shrink-0 self-center text-[0.75rem] font-semibold opacity-60">{item.unavailable ? 'Unavailable' : 'Go →'}</span>
    </button>
  );
}

export interface DashboardActionsSectionProps {
  ebayAuthenticated: boolean;
  ebayDraftCount: number;
  ebayPublishedCount: number;
  ebayTotal: number;
  shopifyQueueApproved: number;
  shopifyQueuePending: number;
  shopifyQueueTotal: number;
  workflowPostPublishLoading: boolean;
  workflowActiveListingCount: number;
  workflowStaleListingCount: number;
  workflowStaleListingUnassignedCount: number;
  workflowSoldReadyCount: number;
  workflowSoldReadyUnassignedCount: number;
  workflowShippedCount: number;
  ebayUnavailableReason?: string | null;
  shopifyApprovalUnavailableReason?: string | null;
  onSelectTab: (tab: DashboardTargetTab) => void;
  onOpenInventoryPostPublishBucket: (bucket: UsedGearWorkflowPostPublishBucket, ownerFilter?: UsedGearWorkflowPostPublishOwnerFilter) => void;
  embedded?: boolean;
}

export function DashboardActionsSection({
  ebayAuthenticated,
  ebayDraftCount,
  ebayPublishedCount,
  ebayTotal,
  shopifyQueueApproved,
  shopifyQueuePending,
  shopifyQueueTotal,
  workflowPostPublishLoading,
  workflowActiveListingCount,
  workflowStaleListingCount,
  workflowStaleListingUnassignedCount,
  workflowSoldReadyCount,
  workflowSoldReadyUnassignedCount,
  workflowShippedCount,
  ebayUnavailableReason,
  shopifyApprovalUnavailableReason,
  onSelectTab,
  onOpenInventoryPostPublishBucket,
  embedded,
}: DashboardActionsSectionProps) {
  const items: ActionItem[] = [];

  if (shopifyApprovalUnavailableReason) {
    items.push({
      key: 'listings-shopify-unavailable',
      label: 'Shopify listings review unavailable',
      count: 0,
      detail: shopifyApprovalUnavailableReason,
      severity: 'warning',
      targetTab: 'listings',
      unavailable: true,
    });
  }

  if (!shopifyApprovalUnavailableReason && shopifyQueuePending > 0) {
    items.push({
      key: 'listings-shopify',
      label: `${shopifyQueuePending} listing${shopifyQueuePending === 1 ? '' : 's'} awaiting review`,
      count: shopifyQueuePending,
      detail: `${shopifyQueueApproved} approved · ${shopifyQueueTotal} total in queue`,
      severity: 'critical',
      targetTab: 'listings',
    });
  }

  if (ebayUnavailableReason) {
    items.push({
      key: 'ebay-unavailable',
      label: 'eBay snapshot unavailable',
      count: 0,
      detail: ebayUnavailableReason,
      severity: 'warning',
      targetTab: 'ebay',
      unavailable: true,
    });
  }

  if (!ebayUnavailableReason && ebayAuthenticated && ebayDraftCount > 0) {
    items.push({
      key: 'ebay',
      label: `${ebayDraftCount} eBay draft${ebayDraftCount === 1 ? '' : 's'} need listings review`,
      count: ebayDraftCount,
      detail: `Open Listings to approve or adjust data before publishing · ${ebayPublishedCount} currently live · ${ebayTotal} total tracked SKUs`,
      severity: 'warning',
      targetTab: 'listings',
    });
  }

  if (!workflowPostPublishLoading && workflowSoldReadyCount > 0) {
    items.push({
      key: 'used-gear-sold-ready',
      label: `${workflowSoldReadyCount} used-gear item${workflowSoldReadyCount === 1 ? '' : 's'} sold and ready to ship`,
      count: workflowSoldReadyCount,
      detail: `${workflowSoldReadyUnassignedCount} unassigned · ${workflowStaleListingCount} stale listing${workflowStaleListingCount === 1 ? '' : 's'} pending review · ${workflowShippedCount} shipped`,
      severity: 'critical',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'sold-ready',
      inventoryPostPublishOwnerFilter: workflowSoldReadyUnassignedCount > 0 ? 'unassigned' : 'all',
    });
  }

  if (!workflowPostPublishLoading && workflowStaleListingCount > 0) {
    items.push({
      key: 'used-gear-stale',
      label: `${workflowStaleListingCount} used-gear listing${workflowStaleListingCount === 1 ? '' : 's'} stale`,
      count: workflowStaleListingCount,
      detail: `${workflowStaleListingUnassignedCount} unassigned · ${workflowActiveListingCount} active listing${workflowActiveListingCount === 1 ? '' : 's'} · ${workflowSoldReadyCount} sold ready to ship`,
      severity: 'warning',
      targetTab: 'inventory',
      inventoryPostPublishBucket: 'stale-listing',
      inventoryPostPublishOwnerFilter: workflowStaleListingUnassignedCount > 0 ? 'unassigned' : 'all',
    });
  }

  const content = items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[12px] border border-emerald-500/25 bg-emerald-950/20 px-4 py-4 text-[0.88rem] text-emerald-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>All clear — no actions required right now.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <ActionButton
              key={item.key}
              item={item}
              onSelectTab={onSelectTab}
              onOpenInventoryPostPublishBucket={onOpenInventoryPostPublishBucket}
            />
          ))}
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
