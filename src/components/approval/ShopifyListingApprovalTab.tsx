import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import { checkOptionalEnv } from '@/config/runtimeEnv';

interface ShopifyListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

export function ShopifyListingApprovalTab({ viewModel }: ShopifyListingApprovalTabProps) {
  const tableReference = checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
  const tableName = checkOptionalEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');

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
