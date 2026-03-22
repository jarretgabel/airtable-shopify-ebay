import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';

interface EbayListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

export function EbayListingApprovalTab({ viewModel }: EbayListingApprovalTabProps) {
  const tableReference = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim();
  const tableName = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim();

  return (
    <ListingApprovalTab
      viewModel={viewModel}
      tableReference={tableReference}
      tableName={tableName}
      approvalChannel="ebay"
    />
  );
}
