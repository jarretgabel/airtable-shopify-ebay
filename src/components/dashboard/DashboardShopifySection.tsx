import type { WorkflowCard, DashboardTargetTab } from './dashboardTabTypes';
import { DashboardSectionPanel, DashboardSubPanel, StatTile, MetricRow } from './dashboardPrimitives';
import { DashboardWorkflowCardGrid } from './DashboardWorkflowSections';

interface DashboardShopifySectionProps {
  shopifyCards: WorkflowCard[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  spLoading: boolean;
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
      <DashboardSubPanel title="Sales Performance">

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Active Mix" value={spLoading ? '…' : `${activeShare}%`} />
          <StatTile label="Draft Mix" value={spLoading ? '…' : `${draftShare}%`} />
          <StatTile label="Archived Mix" value={spLoading ? '…' : `${archivedShare}%`} />
          <StatTile label="Open Pipeline" value={spLoading ? '…' : openPipelineCount} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
          <MetricRow label="Total Listings" value={spLoading ? '…' : productsCount} />
          <MetricRow label="Active" value={spLoading ? '…' : activeProductsCount} valueClass="text-green-400" />
          <MetricRow label="Draft / Pending" value={spLoading ? '…' : draftProductsCount} valueClass="text-amber-400" />
          <MetricRow label="Sold / Archived" value={spLoading ? '…' : archivedProductsCount} valueClass="font-medium text-[var(--muted)]" />
          <MetricRow label="Open Pipeline" value={spLoading ? '…' : openPipelineCount} valueClass="text-blue-300" />
          <MetricRow label="Active Share" value={spLoading ? '…' : `${activeShare}%`} />
          <MetricRow label="Draft Share" value={spLoading ? '…' : `${draftShare}%`} valueClass="text-amber-400" />
          <MetricRow label="Archived Share" value={spLoading ? '…' : `${archivedShare}%`} valueClass="font-medium text-[var(--muted)]" />
        </div>
      </DashboardSubPanel>

      {shopifyCards.length > 0 && (
        <DashboardWorkflowCardGrid title="Shopify Queue & Products" cards={shopifyCards} onSelect={onSelectTab} />
      )}
    </DashboardSectionPanel>
  );
}
