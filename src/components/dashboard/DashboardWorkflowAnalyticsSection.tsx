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
  { label: 'Testing', status: 'Testing In Progress' },
  { label: 'Photography', status: 'Photography In Progress' },
  { label: 'Listing Review', status: 'Awaiting Pre-Listing Review' },
  { label: 'Approved For Publish', status: 'Approved for Publish' },
];

interface DashboardWorkflowAnalyticsSectionProps {
  loading: boolean;
  error: string | null;
  snapshot: UsedGearWorkflowAnalyticsSnapshot;
  staleListingUnassignedCount?: number;
  soldReadyUnassignedCount?: number;
  embedded?: boolean;
  showWarnings?: boolean;
}

function formatLifecycleMetric(value: number | null): string {
  return value === null ? 'N/A' : `${value.toFixed(1)}d`;
}

function formatCurrencyMetric(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function DashboardWorkflowAnalyticsSection({
  loading,
  error,
  snapshot,
  staleListingUnassignedCount = 0,
  soldReadyUnassignedCount = 0,
  embedded = false,
  showWarnings,
}: DashboardWorkflowAnalyticsSectionProps) {
  const shouldShowWarnings = showWarnings ?? true;
  const hasData = snapshot.totalCount > 0;
  if (!shouldShowWarnings && error && !hasData) {
    return null;
  }
  const compactRows = (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
        <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Queue Health</h4>
        <div className="mt-2">
          <MetricRow label="Pending Review" value={snapshot.pendingReviewCount} />
          <MetricRow label={`${USED_GEAR_PENDING_REVIEW_ALERT_DAYS}+d In Review`} value={snapshot.age.pendingReviewAlertCount} />
          <MetricRow label="In Progress" value={snapshot.progressCount} />
          <MetricRow label={`${USED_GEAR_PROGRESS_ALERT_DAYS}+d In Stage`} value={snapshot.age.progressAlertCount} />
          <MetricRow label="Oldest Active Stage" value={formatUsedGearAgeDays(snapshot.age.oldestProgressAgeDays)} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
        <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Publish Pressure</h4>
        <div className="mt-2">
          <MetricRow label="Post-Publish" value={snapshot.postPublishCount} />
          <MetricRow label="Sold Ready Waiting" value={snapshot.lifecycle.soldReadyAwaitingShipmentCount} />
          <MetricRow label="Stale Follow-Up" value={snapshot.age.staleFollowUpCount} />
          <MetricRow label="Stale Unassigned" value={staleListingUnassignedCount} />
          <MetricRow label="Sold Ready Unassigned" value={soldReadyUnassignedCount} />
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
        <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Sale Reporting</h4>
        <div className="mt-2">
          <MetricRow label="Open Exceptions" value={snapshot.postSale.unresolvedExceptionCount} />
          <MetricRow label="Resolved Exceptions" value={snapshot.postSale.resolvedExceptionCount} />
          <MetricRow label="Missing Disposition" value={snapshot.postSale.missingDispositionCount} />
          <MetricRow label="Returns Received" value={snapshot.postSale.returnReceivedCount} />
          <MetricRow label="Refund Exposure" value={formatCurrencyMetric(snapshot.postSale.refundExposure)} />
        </div>
      </section>
    </div>
  );

  return (
    <DashboardSubPanel title="Used Gear Workflow Snapshot" className={loading && !embedded ? 'min-h-[1240px] xl:min-h-[840px]' : undefined}>
      <p className="m-0 text-[0.82rem] leading-[1.55] text-[var(--muted)]">
        Quick view of queue age and post-publish load.
      </p>

      {loading ? <DashboardLoadingBanner label="Refreshing used-gear workflow analytics..." /> : null}
      {shouldShowWarnings && error ? <DashboardSourceWarning title="Workflow analytics unavailable" message={error} /> : null}

      {loading ? (
        <>
          <DashboardStatTileSkeletonGrid />
          <div className={`grid gap-4 ${embedded ? 'xl:grid-cols-2' : 'xl:grid-cols-3 2xl:grid-cols-5'}`}>
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Status</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={8} /></div>
            </section>
            <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
              <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Age And SLA</h4>
              <div className="mt-2"><DashboardMetricRowSkeletonList count={8} /></div>
            </section>
            {!embedded ? (
              <>
                <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
                  <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">By Marketplace</h4>
                  <div className="mt-2"><DashboardMetricRowSkeletonList count={6} /></div>
                </section>
                <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
                  <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Publish Ops</h4>
                  <div className="mt-2"><DashboardMetricRowSkeletonList count={6} /></div>
                </section>
                <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
                  <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Sale Reporting</h4>
                  <div className="mt-2"><DashboardMetricRowSkeletonList count={6} /></div>
                </section>
              </>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label="Operational Rows" value={snapshot.totalCount} />
            <StatTile label="Pending Review" value={snapshot.pendingReviewCount} />
            <StatTile label="In Progress" value={snapshot.progressCount} />
            <StatTile label="Post-Publish" value={snapshot.postPublishCount} />
          </div>

          {compactRows}

          {embedded ? (
            <details className="rounded-[12px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_86%,transparent)] px-4 py-3">
              <summary className="cursor-pointer list-none text-[0.8rem] font-semibold text-[var(--ink)]">
                More workflow context
              </summary>
              <div className="mt-3 grid gap-4 xl:grid-cols-3 2xl:grid-cols-5">
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
                    <MetricRow label="Oldest Pending Review" value={formatUsedGearAgeDays(snapshot.age.oldestPendingReviewAgeDays)} />
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
                    <MetricRow label="Oldest Sold Ready" value={formatLifecycleMetric(snapshot.lifecycle.oldestSoldReadyAgeDays)} />
                  </div>
                </section>

                <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
                  <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Sale Reporting</h4>
                  <div className="mt-2">
                    <MetricRow label="Open Exceptions" value={snapshot.postSale.unresolvedExceptionCount} />
                    <MetricRow label="Resolved Exceptions" value={snapshot.postSale.resolvedExceptionCount} />
                    <MetricRow label="Refunded" value={snapshot.postSale.refundedCount} />
                    <MetricRow label="Returned" value={snapshot.postSale.returnedCount} />
                    <MetricRow label="Partial Refund" value={snapshot.postSale.partialRefundCount} />
                    <MetricRow label="Cancelled" value={snapshot.postSale.cancelledCount} />
                    <MetricRow label="Returns Received" value={snapshot.postSale.returnReceivedCount} />
                    <MetricRow label="Missing Disposition" value={snapshot.postSale.missingDispositionCount} />
                    <MetricRow label="Refund Exposure" value={formatCurrencyMetric(snapshot.postSale.refundExposure)} />
                  </div>
                </section>
              </div>
            </details>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-5">
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

              <section className="rounded-[12px] border border-[var(--line)] bg-[var(--panel)] px-4 py-4">
                <h4 className="m-0 border-b border-[var(--line)] pb-3 text-[0.84rem] font-bold uppercase tracking-[0.08em] text-[var(--ink)]">Post-Sale Reporting</h4>
                <div className="mt-2">
                  <MetricRow label="Open Exceptions" value={snapshot.postSale.unresolvedExceptionCount} />
                  <MetricRow label="Resolved Exceptions" value={snapshot.postSale.resolvedExceptionCount} />
                  <MetricRow label="Refunded" value={snapshot.postSale.refundedCount} />
                  <MetricRow label="Returned" value={snapshot.postSale.returnedCount} />
                  <MetricRow label="Partial Refund" value={snapshot.postSale.partialRefundCount} />
                  <MetricRow label="Cancelled" value={snapshot.postSale.cancelledCount} />
                  <MetricRow label="Returns Received" value={snapshot.postSale.returnReceivedCount} />
                  <MetricRow label="Missing Disposition" value={snapshot.postSale.missingDispositionCount} />
                  <MetricRow label="Refund Exposure" value={formatCurrencyMetric(snapshot.postSale.refundExposure)} />
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </DashboardSubPanel>
  );
}