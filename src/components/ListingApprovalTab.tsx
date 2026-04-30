import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { ListingApprovalQueuePanel } from '@/components/approval/ListingApprovalQueuePanel';
import { ListingApprovalSelectedRecordPanel } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import { useListingApprovalTabState } from '@/components/approval/useListingApprovalTabState';
import { panelSurfaceClass } from '@/components/tabs/uiClasses';

interface ListingApprovalTabProps {
  viewModel: ApprovalTabViewModel;
  tableReference?: string;
  tableName?: string;
  createShopifyDraftOnApprove?: boolean;
  approvalChannel?: 'shopify' | 'ebay' | 'combined';
}

export function ListingApprovalTab({
  viewModel,
  tableReference: propsTableReference,
  tableName: propTableName,
  createShopifyDraftOnApprove = false,
  approvalChannel = 'ebay',
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
  });

  if (selectedRecord) {
    return (
      <>
        <section className={panelSurfaceClass}>
          <ListingApprovalSelectedRecordPanel {...selectedRecordPanelProps!} />
        </section>
        {confirmationModal}
      </>
    );
  }

  return (
    <>
      <ListingApprovalQueuePanel {...queuePanelProps} />
      {confirmationModal}
    </>
  );
}
