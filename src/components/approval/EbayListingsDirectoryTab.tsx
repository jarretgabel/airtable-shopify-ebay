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
  const usingAirtableSnapshot = ebayViewModel.snapshot.source === 'airtable';
  const liveOffersCount = ebayViewModel.inventory.recentListings.length;
  const draftOffersCount = ebayViewModel.inventory.offers.filter((offer) => {
    const normalizedStatus = offer.status?.toLowerCase();
    return normalizedStatus === 'draft' || normalizedStatus === 'unpublished';
  }).length;
  const trackedInventoryCount = ebayViewModel.inventory.total;
  const connectionStatus = usingAirtableSnapshot
    ? 'Sheet Snapshot'
    : ebayViewModel.session.restoringSession
    ? 'Restoring'
    : ebayViewModel.session.authenticated
      ? 'Connected'
      : 'Disconnected';

  return (
    <div className="space-y-4">
      <ListingsServiceSummaryPanel
        eyebrow="eBay Directory"
        title="eBay Listing Snapshot"
        description={usingAirtableSnapshot
          ? 'This page is read-only. The live eBay runtime is unavailable, so this screen is showing Airtable-backed eBay listing snapshots instead. Use the combined Listings page for approvals, edits, and listing changes.'
          : 'This page is read-only. Use the combined Listings page for approvals, edits, and listing changes; keep this screen for eBay inventory, offer, and connection visibility only.'}
        stats={[
          { label: 'Live Offers', value: liveOffersCount },
          { label: 'Draft Offers', value: draftOffersCount },
          { label: 'Tracked Inventory', value: trackedInventoryCount },
          { label: usingAirtableSnapshot ? 'Snapshot Source' : 'Connection', value: connectionStatus },
        ]}
        metrics={[
          { label: 'Tracked inventory items', value: trackedInventoryCount },
          { label: 'Recent live listings', value: liveOffersCount, valueClass: 'text-green-400' },
          { label: 'Draft offers', value: draftOffersCount, valueClass: 'text-amber-400' },
          { label: 'Known offers', value: ebayViewModel.inventory.offers.length },
          {
            label: usingAirtableSnapshot ? 'Snapshot source' : 'Connection status',
            value: connectionStatus,
            valueClass: usingAirtableSnapshot || ebayViewModel.session.authenticated ? 'text-green-400' : 'text-[var(--ink)]',
          },
        ]}
      />

      <EbayTab viewModel={ebayViewModel} onOpenSnapshotRecord={onOpenSnapshotRecord} />
    </div>
  );
}