import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalTab } from '@/components/ListingApprovalTab';

interface CombinedListingsApprovalTabProps {
  viewModel: ApprovalTabViewModel;
}

const COMBINED_LISTINGS_TABLE_NAME = (import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME as string | undefined)?.trim() || 'tbl0K0nFQL64jQMx8';
const COMBINED_LISTINGS_TABLE_REF = (import.meta.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF as string | undefined)?.trim();

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
