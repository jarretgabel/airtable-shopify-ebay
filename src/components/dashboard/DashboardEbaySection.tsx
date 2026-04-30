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
        {ebayLoading ? (
          <div className="space-y-4">
            <DashboardStatTileSkeletonGrid />
            <DashboardMetricRowSkeletonList count={6} />
          </div>
        ) : (
          <>
            {ebayError && (
              <DashboardSourceWarning
                title={ebayTotal > 0 ? 'eBay metrics are showing the last successful snapshot' : 'eBay data is unavailable right now'}
                message={ebayError}
              />
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Live Share" value={`${liveShare}%`} />
              <StatTile label="Draft Share" value={`${draftShare}%`} />
              <StatTile label="Offer Coverage" value={`${coverageRate}%`} />
              <StatTile label="Connection" value={connectionValue} />
            </div>

            {!ebayError && (
              <div className="grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
                <MetricRow label="Tracked SKUs" value={ebayTotal} />
                <MetricRow label="Live Offers" value={ebayPublishedCount} valueClass="text-green-400" />
                <MetricRow label="Draft Offers" value={ebayDraftCount} valueClass="text-amber-400" />
                <MetricRow label="Without Offer" value={noOfferCount} valueClass="text-[var(--muted)]" />
                <MetricRow label="Offer Coverage" value={`${coverageRate}%`} />
                <MetricRow label="Connection Status" value={connectionValue} valueClass={ebayAuthenticated ? 'text-green-400' : 'text-[var(--ink)]'} />
              </div>
            )}
          </>
        )}
      </DashboardSubPanel>
      {ebayLoading ? (
        <DashboardWorkflowCardSkeletonGrid />
      ) : (
        <DashboardWorkflowCardGrid title="Publishing & Queue" cards={cards} onSelect={onSelectTab} />
      )}
    </DashboardSectionPanel>
  );
}