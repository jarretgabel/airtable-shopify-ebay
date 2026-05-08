import type { EbayTabViewModel } from '@/app/appTabViewModels';
import { ListingsServiceSummaryPanel } from '@/components/approval/ListingsServiceSummaryPanel';
import { EbayTab } from '@/components/EbayTab';

interface EbayListingsDirectoryTabProps {
  ebayViewModel: EbayTabViewModel;
  onOpenSnapshotRecord: (recordId: string) => void;
}

export function EbayListingsDirectoryTab({
  ebayViewModel,
  onOpenSnapshotRecord,
}: EbayListingsDirectoryTabProps) {
  const liveOffersCount = ebayViewModel.inventory.recentListings.length;
  const draftOffersCount = ebayViewModel.inventory.offers.filter((offer) => offer.status?.toLowerCase() === 'draft').length;
  const trackedInventoryCount = ebayViewModel.inventory.total;
  const connectionStatus = ebayViewModel.session.restoringSession
    ? 'Restoring'
    : ebayViewModel.session.authenticated
      ? 'Connected'
      : 'Disconnected';

  return (
    <div className="space-y-4">
      <ListingsServiceSummaryPanel
        eyebrow="eBay Directory"
        title="eBay Listing Snapshot"
        description="This page is read-only. Use the combined Listings page for approvals, edits, and listing changes; keep this screen for eBay inventory, offer, and connection visibility only."
        stats={[
          { label: 'Live Offers', value: liveOffersCount },
          { label: 'Draft Offers', value: draftOffersCount },
          { label: 'Tracked Inventory', value: trackedInventoryCount },
          { label: 'Connection', value: connectionStatus },
        ]}
        metrics={[
          { label: 'Tracked inventory items', value: trackedInventoryCount },
          { label: 'Recent live listings', value: liveOffersCount, valueClass: 'text-green-400' },
          { label: 'Draft offers', value: draftOffersCount, valueClass: 'text-amber-400' },
          { label: 'Known offers', value: ebayViewModel.inventory.offers.length },
          {
            label: 'Connection status',
            value: connectionStatus,
            valueClass: ebayViewModel.session.authenticated ? 'text-green-400' : 'text-[var(--ink)]',
          },
        ]}
      />

      <EbayTab viewModel={ebayViewModel} onOpenSnapshotRecord={onOpenSnapshotRecord} />
    </div>
  );
}