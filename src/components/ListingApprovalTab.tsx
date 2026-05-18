import type { ApprovalTabViewModel } from '@/app/appTabViewModels';
import { AppPageLayout } from '@/components/app/AppPageLayout';
import { secondaryActionButtonClass } from '@/components/app/buttonStyles';
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

  if (viewModel.selectedRecordId && !queuePanelProps.loading && !queuePanelProps.error) {
    return (
      <AppPageLayout>
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]/70 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Listing Record</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--text)]">Listing record not found</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The requested listing record is not available in the current dataset. If sample data was reseeded, the old record ID may no longer exist.
          </p>
          <div className="mt-5">
            <button type="button" className={secondaryActionButtonClass} onClick={viewModel.onBackToList}>
              Back to listings directory
            </button>
          </div>
        </section>
        {confirmationModal}
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout>
      <ListingApprovalQueuePanel {...queuePanelProps} />
      {confirmationModal}
    </AppPageLayout>
  );
}
