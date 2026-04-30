import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';
import { checkOptionalEnv } from '@/config/runtimeEnv';

interface CombinedListingsApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

const COMBINED_LISTINGS_TABLE_NAME = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');
const COMBINED_LISTINGS_TABLE_REF = checkOptionalEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');

export function CombinedListingsApprovalTab({ viewModel }: CombinedListingsApprovalTabProps) {
  const tableReference = COMBINED_LISTINGS_TABLE_REF;

  return (
    <ListingApprovalTab
      viewModel={viewModel}
      tableReference={tableReference}
      tableName={COMBINED_LISTINGS_TABLE_NAME}
      approvalChannel="combined"
      createShopifyDraftOnApprove
    />
  );
}
