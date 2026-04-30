import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import { checkOptionalEnv } from '@/config/runtimeEnv';

interface EbayListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

export function EbayListingApprovalTab({ viewModel }: EbayListingApprovalTabProps) {
  const tableReference = checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF');
  const tableName = checkOptionalEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME');

  return (
    <ListingApprovalTab
      viewModel={viewModel}
      tableReference={tableReference}
      tableName={tableName}
      approvalChannel="ebay"
    />
  );
}
