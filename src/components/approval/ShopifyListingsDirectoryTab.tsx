import type { ShopifyTabViewModel } from '@/app/appTabViewModels';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { AppPageSectionSurface } from '@/components/app/AppPageSectionSurface';
import { OpenLinkToolbarButton } from '@/components/app/OpenLinkToolbarButton';
import { WorkflowPageHeader } from '@/components/app/WorkflowPageHeader';
import { ListingsServiceSummaryPanel } from '@/components/approval/ListingsServiceSummaryPanel';
import { ShopifyTab } from '@/components/tabs/ShopifyTab';

interface ShopifyListingsDirectoryTabProps {
  shopifyViewModel: ShopifyTabViewModel;
  onOpenSnapshotRecord: (recordId: string) => void;
}

export function ShopifyListingsDirectoryTab({
  shopifyViewModel,
  onOpenSnapshotRecord,
}: ShopifyListingsDirectoryTabProps) {
  const activeProductsCount = shopifyViewModel.products.filter((product) => product.status?.toLowerCase() === 'active').length;
  const draftProductsCount = shopifyViewModel.products.filter((product) => product.status?.toLowerCase() === 'draft').length;
  const archivedProductsCount = shopifyViewModel.products.filter((product) => product.status?.toLowerCase() === 'archived').length;
  const shopifyStoreHref = shopifyViewModel.storeDomain?.trim() || '';

  return (
    <AppPageLayout>
      <WorkflowPageHeader
        eyebrow="Channels"
        title="Shopify Product Snapshot"
        actions={shopifyStoreHref ? <OpenLinkToolbarButton label="Open Shopify store" href={shopifyStoreHref} /> : null}
      />

      <AppPageSectionSurface className="space-y-5">
        <ListingsServiceSummaryPanel
          eyebrow="Channels"
          title="Shopify Product Snapshot"
          description="This page is read-only. Use the combined Listings page for all approvals, edits, and publishing decisions; keep this screen for store-side product visibility only."
          showHeader={false}
          stats={[
            { label: 'Active Products', value: activeProductsCount },
            { label: 'Draft Products', value: draftProductsCount },
            { label: 'Archived Products', value: archivedProductsCount },
          ]}
          metrics={[
            { label: 'Tracked products', value: shopifyViewModel.products.length },
            { label: 'Active products', value: activeProductsCount, valueClass: 'text-green-400' },
            { label: 'Draft products', value: draftProductsCount, valueClass: 'text-amber-400' },
            { label: 'Archived products', value: archivedProductsCount, valueClass: 'text-[var(--muted)]' },
          ]}
        />

        <ShopifyTab viewModel={shopifyViewModel} onOpenProduct={onOpenSnapshotRecord} />
      </AppPageSectionSurface>
    </AppPageLayout>
  );
}