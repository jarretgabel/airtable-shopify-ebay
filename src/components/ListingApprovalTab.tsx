import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { ListingApprovalQueuePanel } from '@/components/approval/ListingApprovalQueuePanel';
import { ListingApprovalSelectedRecordPanel } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import { useListingApprovalTabState } from '@/components/approval/useListingApprovalTabState';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
  backToListLabel?: string;
}

export function ListingApprovalTab({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
  backToListLabel,
}: ListingApprovalTabProps) {
  const {
    selectedRecord,
    selectedRecordPanelProps,
    queuePanelProps,
    confirmationModal,
  } = useListingApprovalTabState({
    viewModel,
    tableReference: propsTableReference,
    tableName: propTableName,
    createShopifyDraftOnApprove,
    approvalChannel,
    backToListLabel,
  });

  if (selectedRecord) {
    return (
      <>
        <ListingApprovalSelectedRecordPanel {...selectedRecordPanelProps!} />
        {confirmationModal}
      </>
    );
  }

  return (
    <AppPageLayout>
      <ListingApprovalQueuePanel {...queuePanelProps} />
      {confirmationModal}
    </AppPageLayout>
  );
}
