import type { WorkflowCard, DashboardTargetTab } from './dashboardTabTypes';
import {
  DashboardMetricRowSkeletonList,
  DashboardSectionPanel,
  DashboardStatTileSkeletonGrid,
  DashboardSourceWarning,
  DashboardSubPanel,
  DashboardWorkflowCardSkeletonGrid,
  MetricRow,
  StatTile,
} from './dashboardPrimitives';
import { DashboardWorkflowCardGrid } from './DashboardWorkflowSections';

interface DashboardShopifySectionProps {
  shopifyCards: WorkflowCard[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  spLoading: boolean;
  errorMessage?: string | null;
  productsCount: number;
  activeProductsCount: number;
  draftProductsCount: number;
  archivedProductsCount: number;
}

export function DashboardShopifySection(props: DashboardShopifySectionProps) {
  const {
    shopifyCards,
    onSelectTab,
    spLoading,
    errorMessage,
    productsCount,
    activeProductsCount,
    draftProductsCount,
    archivedProductsCount,
  } = props;

  const safeProductsCount = Math.max(productsCount, 1);
  const activeShare = productsCount > 0 ? Math.round((activeProductsCount / safeProductsCount) * 100) : 0;
  const draftShare = productsCount > 0 ? Math.round((draftProductsCount / safeProductsCount) * 100) : 0;
  const archivedShare = productsCount > 0 ? Math.round((archivedProductsCount / safeProductsCount) * 100) : 0;
  const openPipelineCount = activeProductsCount + draftProductsCount;

  return (
    <DashboardSectionPanel id="pipeline" title="Shopify">
      {errorMessage && !spLoading && (
        <DashboardSourceWarning
          title={productsCount > 0 ? 'Shopify metrics are showing the last successful snapshot' : 'Shopify data is unavailable right now'}
          message={errorMessage}
        />
      )}
      <DashboardSubPanel title="Pipeline Summary">
        {spLoading ? (
          <div className="space-y-4">
            <DashboardStatTileSkeletonGrid />
            <DashboardMetricRowSkeletonList count={4} />
          </div>
        ) : (
          <>
            <p className="m-0 text-[0.82rem] leading-[1.55] text-[var(--muted)]">
              Use this section for quick pipeline balance checks. Open the cards below when you need the store snapshot or the listings approval queue.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Active Mix" value={`${activeShare}%`} />
              <StatTile label="Draft Mix" value={`${draftShare}%`} />
              <StatTile label="Archived Mix" value={`${archivedShare}%`} />
              <StatTile label="Open Pipeline" value={openPipelineCount} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
              <MetricRow label="Total Listings" value={productsCount} />
              <MetricRow label="Open Pipeline" value={openPipelineCount} valueClass="text-blue-300" />
              <MetricRow label="Live Inventory" value={activeProductsCount} valueClass="text-green-400" />
              <MetricRow label="Awaiting Review / Draft" value={draftProductsCount} valueClass="text-amber-400" />
              <MetricRow label="Closed Out" value={archivedProductsCount} valueClass="font-medium text-[var(--muted)]" />
            </div>
          </>
        )}
      </DashboardSubPanel>

      {spLoading ? (
        <DashboardWorkflowCardSkeletonGrid />
      ) : shopifyCards.length > 0 && (
        <DashboardWorkflowCardGrid title="Shopify Snapshot & Queue" cards={shopifyCards} onSelect={onSelectTab} />
      )}
    </DashboardSectionPanel>
  );
}
