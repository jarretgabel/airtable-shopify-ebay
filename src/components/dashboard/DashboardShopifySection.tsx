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
  avgAskPrice: number;
  inventoryValue: number;
  grossMarginPct: number | null;
  acquisitionCost: number;
  totalAsk: number;
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
    avgAskPrice,
    inventoryValue,
    grossMarginPct,
    acquisitionCost,
    totalAsk,
  } = props;

  const safeProductsCount = Math.max(productsCount, 1);
  const activeShare = productsCount > 0 ? Math.round((activeProductsCount / safeProductsCount) * 100) : 0;
  const draftShare = productsCount > 0 ? Math.round((draftProductsCount / safeProductsCount) * 100) : 0;
  const archivedShare = productsCount > 0 ? Math.round((archivedProductsCount / safeProductsCount) * 100) : 0;
  const markupMultiple = acquisitionCost > 0 && totalAsk > 0 ? totalAsk / acquisitionCost : null;

  return (
    <DashboardSectionPanel id="pipeline" title="Shopify">
      <DashboardSubPanel title="Sales Performance">

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Active Mix" value={spLoading ? '…' : `${activeShare}%`} />
          <StatTile label="Draft Mix" value={spLoading ? '…' : `${draftShare}%`} />
          <StatTile label="Archived Mix" value={spLoading ? '…' : `${archivedShare}%`} />
          <StatTile label="Markup Multiple" value={spLoading ? '…' : markupMultiple ? `${markupMultiple.toFixed(2)}x` : '—'} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
          <MetricRow label="Total Listings" value={spLoading ? '…' : productsCount} />
          <MetricRow label="Active" value={spLoading ? '…' : activeProductsCount} valueClass="text-green-400" />
          <MetricRow label="Draft / Pending" value={spLoading ? '…' : draftProductsCount} valueClass="text-amber-400" />
          <MetricRow label="Sold / Archived" value={spLoading ? '…' : archivedProductsCount} valueClass="font-medium text-[var(--muted)]" />
          <MetricRow label="Avg Ask Price" value={spLoading ? '…' : avgAskPrice > 0 ? `$${Math.round(avgAskPrice).toLocaleString()}` : '—'} />
          <MetricRow label="Total Ask Value" value={spLoading ? '…' : inventoryValue > 0 ? `$${inventoryValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
          <MetricRow label="Cost Basis" value={spLoading ? '…' : acquisitionCost > 0 ? `$${acquisitionCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} />
          <MetricRow label="Gross Margin" value={grossMarginPct !== null ? `${grossMarginPct}%` : '—'} valueClass={grossMarginPct !== null && grossMarginPct > 0 ? 'text-green-400' : 'text-[var(--ink)]'} />
          <MetricRow label="Potential Profit" value={acquisitionCost > 0 && totalAsk > 0 ? `$${(totalAsk - acquisitionCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'} valueClass="text-green-400" />
        </div>
      </DashboardSubPanel>

      {shopifyCards.length > 0 && (
        <DashboardWorkflowCardGrid title="Shopify Queue & Products" cards={shopifyCards} onSelect={onSelectTab} />
      )}
    </DashboardSectionPanel>
  );
}
