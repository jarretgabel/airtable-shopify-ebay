import {
  DashboardLoadingBanner,
  DashboardMetricRowSkeletonList,
  DashboardSourceWarning,
  DashboardStatTileSkeletonGrid,
  DashboardSubPanel,
  MetricRow,
  StatTile,
} from '@/components/dashboard/dashboardPrimitives';
import {
  formatUsedGearAgeDays,
  USED_GEAR_ACTIVE_LISTING_WARNING_DAYS,
  USED_GEAR_PENDING_REVIEW_ALERT_DAYS,
  USED_GEAR_PROGRESS_ALERT_DAYS,
  USED_GEAR_STALE_FOLLOW_UP_ALERT_DAYS,
} from '@/services/usedGearWorkflowAging';
import type { UsedGearWorkflowAnalyticsSnapshot } from '@/services/usedGearWorkflowAnalytics';
import type { UsedGearWorkflowStatus } from '@/services/usedGearWorkflow';

const STATUS_ROWS: Array<{ label: string; status: UsedGearWorkflowStatus }> = [
  { label: 'Pending Review', status: 'Pending Review' },
  { label: 'Trash', status: 'Unqualified' },
  { label: 'Awaiting Arrival', status: 'Accepted - Awaiting Arrival' },
  { label: 'Awaiting SKU', status: 'Accepted - Arrived, Awaiting SKU' },
  { label: 'Awaiting Missing Item', status: 'Accepted - Arrived, Awaiting Missing Item' },
  { label: 'Testing + Photo', status: 'Testing and Photography In Progress' },
  { label: 'Pre-Listing Review', status: 'Awaiting Pre-Listing Review' },
  { label: 'Approved For Publish', status: 'Approved for Publish' },
];

interface DashboardWorkflowAnalyticsSectionProps {
  loading: boolean;
  error: string | null;
  snapshot: UsedGearWorkflowAnalyticsSnapshot;
  staleListingUnassignedCount?: number;
  soldReadyUnassignedCount?: number;
}

function formatLifecycleMetric(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}d`;
}

export function DashboardWorkflowAnalyticsSection({
  loading,
  error,
  snapshot,
  staleListingUnassignedCount = 0,
  soldReadyUnassignedCount = 0,
}: DashboardWorkflowAnalyticsSectionProps) {
  return (
    <DashboardSubPanel title="Used Gear Workflow Snapshot" className={loading ? 'min-h-[1240px] xl:min-h-[840px]' : undefined}>
      <p className="m-0 text-[0.82rem] leading-[1.55] text-[var(--muted)]">
        Counts by workflow status, queue age, and marketplace lifecycle so operators can spot intake, processing, and post-publish pressure in one place.
      </p>

      {loading ? <DashboardLoadingBanner label="Refreshing used-gear workflow analytics..." /> : null}
      {error ? <DashboardSourceWarning title="Workflow analytics unavailable" message={error} /> : null}

      {loading ? (
        <>
          <DashboardStatTileSkeletonGrid />
          <div className="grid gap-4 xl:grid-cols-4">
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Status</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={8} /></div>
            </section>
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Age And SLA</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={8} /></div>
            </section>
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Marketplace</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={6} /></div>
            </section>
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Publish Ops</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={6} /></div>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label="Workflow Rows" value={snapshot.totalCount} />
            <StatTile label="Pending Review" value={snapshot.pendingReviewCount} />
            <StatTile label="In Progress" value={snapshot.progressCount} />
            <StatTile label="Post-Publish" value={snapshot.postPublishCount} />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Status</h4>
              <div className="mt-2">
                {STATUS_ROWS.map((row) => (
                  <MetricRow
                    key={row.status}
                    label={row.label}
                    value={row.status === 'Unqualified' ? snapshot.trashCount : snapshot.statusCounts[row.status]}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Age And SLA</h4>
              <div className="mt-2">
                <MetricRow label={`${USED_GEAR_PENDING_REVIEW_ALERT_DAYS}+d In Review`} value={snapshot.age.pendingReviewAlertCount} />
                <MetricRow label="Oldest Pending Review" value={formatUsedGearAgeDays(snapshot.age.oldestPendingReviewAgeDays)} />
                <MetricRow label={`${USED_GEAR_PROGRESS_ALERT_DAYS}+d In Stage`} value={snapshot.age.progressAlertCount} />
                <MetricRow label="Oldest Active Stage" value={formatUsedGearAgeDays(snapshot.age.oldestProgressAgeDays)} />
                <MetricRow label={`${USED_GEAR_ACTIVE_LISTING_WARNING_DAYS}+d Near Stale`} value={snapshot.age.activeNearStaleCount} />
                <MetricRow label={`${USED_GEAR_STALE_FOLLOW_UP_ALERT_DAYS}+d Stale Follow-Up`} value={snapshot.age.staleFollowUpCount} />
                <MetricRow label="Oldest Active Listing" value={formatUsedGearAgeDays(snapshot.age.oldestListedAgeDays)} />
                <MetricRow label="Oldest Stale Listing" value={formatUsedGearAgeDays(snapshot.age.oldestStaleAgeDays)} />
              </div>
            </section>

            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Marketplace</h4>
              <div className="mt-2">
                <MetricRow label="Shopify Live" value={snapshot.marketplace.shopifyLiveCount} />
                <MetricRow label="Shopify Stale" value={snapshot.marketplace.shopifyStaleCount} />
                <MetricRow label="eBay Live" value={snapshot.marketplace.ebayLiveCount} />
                <MetricRow label="eBay Stale" value={snapshot.marketplace.ebayStaleCount} />
                <MetricRow label="Sold Ready To Ship" value={snapshot.marketplace.soldReadyCount} />
                <MetricRow label="Shipped" value={snapshot.marketplace.shippedCount} />
              </div>
            </section>

            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Publish Ops</h4>
              <div className="mt-2">
                <MetricRow label="Avg Days To Sell" value={formatLifecycleMetric(snapshot.lifecycle.averageDaysToSell)} />
                <MetricRow label="Avg Days To Ship" value={formatLifecycleMetric(snapshot.lifecycle.averageDaysToShip)} />
                <MetricRow label="Sold Ready Waiting" value={snapshot.lifecycle.soldReadyAwaitingShipmentCount} />
                <MetricRow label="Oldest Sold Ready" value={formatLifecycleMetric(snapshot.lifecycle.oldestSoldReadyAgeDays)} />
                <MetricRow label="Stale Unassigned" value={staleListingUnassignedCount} />
                <MetricRow label="Sold Ready Unassigned" value={soldReadyUnassignedCount} />
              </div>
            </section>
          </div>
        </>
      )}
    </DashboardSubPanel>
  );
}