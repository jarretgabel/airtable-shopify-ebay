import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';

interface ShopifyListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

export function ShopifyListingApprovalTab({ viewModel }: ShopifyListingApprovalTabProps) {
  const tableReference = (import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF as string | undefined)?.trim();
  const tableName = (import.meta.env.VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME as string | undefined)?.trim();

  return (
    <ListingApprovalTab
      viewModel={viewModel}
      tableReference={tableReference}
      tableName={tableName}
      createShopifyDraftOnApprove
      approvalChannel="shopify"
    />
  );
}
