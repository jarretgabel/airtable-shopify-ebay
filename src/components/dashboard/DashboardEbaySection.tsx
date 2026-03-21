import type { WorkflowCard, DashboardTargetTab } from './dashboardTabTypes';
import { DashboardSectionPanel, DashboardSubPanel, StatTile, MetricRow } from './dashboardPrimitives';
import { DashboardWorkflowCardGrid } from './DashboardWorkflowSections';

interface DashboardEbaySectionProps {
  cards: WorkflowCard[];
  onSelectTab: (tab: DashboardTargetTab) => void;
  ebayLoading: boolean;
  ebayAuthenticated: boolean;
  ebayRestoringSession: boolean;
  ebayError: string | null;
  ebayTotal: number;
  ebayPublishedCount: number;
  ebayDraftCount: number;
}

export function DashboardEbaySection({
  cards,
  onSelectTab,
  ebayLoading,
  ebayAuthenticated,
  ebayRestoringSession,
  ebayError,
  ebayTotal,
  ebayPublishedCount,
  ebayDraftCount,
}: DashboardEbaySectionProps) {
  if (cards.length === 0) return null;

  const safeTotal = Math.max(ebayTotal, 1);
  const liveShare = ebayTotal > 0 ? Math.round((ebayPublishedCount / safeTotal) * 100) : 0;
  const draftShare = ebayTotal > 0 ? Math.round((ebayDraftCount / safeTotal) * 100) : 0;
  const withOffers = ebayPublishedCount + ebayDraftCount;
  const coverageRate = ebayTotal > 0 ? Math.round((withOffers / safeTotal) * 100) : 0;
  const noOfferCount = Math.max(0, ebayTotal - withOffers);
  const connectionValue = ebayRestoringSession ? 'Restoring' : ebayAuthenticated ? 'Connected' : 'Disconnected';

  return (
    <DashboardSectionPanel id="ebay-workflows" title="eBay">
      <DashboardSubPanel title="Sales Performance">

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Live Share" value={ebayLoading ? '…' : `${liveShare}%`} />
          <StatTile label="Draft Share" value={ebayLoading ? '…' : `${draftShare}%`} />
          <StatTile label="Offer Coverage" value={ebayLoading ? '…' : `${coverageRate}%`} />
          <StatTile label="Connection" value={ebayLoading ? '…' : connectionValue} />
        </div>

        {ebayError ? (
          <p className="m-0 rounded-[10px] border border-red-500/30 bg-red-950/20 px-4 py-3 text-[0.84rem] text-red-300">{ebayError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
            <MetricRow label="Tracked SKUs" value={ebayLoading ? '…' : ebayTotal} />
            <MetricRow label="Live Offers" value={ebayLoading ? '…' : ebayPublishedCount} valueClass="text-green-400" />
            <MetricRow label="Draft Offers" value={ebayLoading ? '…' : ebayDraftCount} valueClass="text-amber-400" />
            <MetricRow label="Without Offer" value={ebayLoading ? '…' : noOfferCount} valueClass="text-[var(--muted)]" />
            <MetricRow label="Offer Coverage" value={ebayLoading ? '…' : `${coverageRate}%`} />
            <MetricRow label="Connection Status" value={ebayLoading ? '…' : connectionValue} valueClass={ebayAuthenticated ? 'text-green-400' : 'text-[var(--ink)]'} />
          </div>
        )}
      </DashboardSubPanel>
      <DashboardWorkflowCardGrid title="Publishing & Queue" cards={cards} onSelect={onSelectTab} />
    </DashboardSectionPanel>
  );
}