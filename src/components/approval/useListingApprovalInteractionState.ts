import { useApprovalInlineNotices } from '@/hooks/approval/useApprovalInlineNotices';
import { useConfirmationDialog } from '@/hooks/useConfirmationDialog';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import type { AirtableRecord } from '@/types/airtable';

interface UseListingApprovalInteractionStateParams {
  selectedRecord: AirtableRecord | null;
  hasUnsavedChanges: boolean;
  saving: boolean;
  approving: boolean;
  pushingTarget: 'shopify' | 'ebay' | 'both' | null;
}

export function useListingApprovalInteractionState({
  selectedRecord,
  hasUnsavedChanges,
  saving,
  approving,
  pushingTarget,
}: UseListingApprovalInteractionStateParams) {
  const {
    inlineActionNotices,
    fadingInlineNoticeIds,
    pushInlineActionNotice,
    resetInlineActionNotices,
  } = useApprovalInlineNotices();
  const { requestConfirmation, confirmationModal } = useConfirmationDialog();

  useUnsavedChangesPrompt({
    when: Boolean(selectedRecord && hasUnsavedChanges && !saving && !approving && !pushingTarget),
    message: 'You have unsaved approval edits. Leave this page and discard them?',
    requestConfirmation,
  });

  return {
    confirmationModal,
    fadingInlineNoticeIds,
    inlineActionNotices,
    pushInlineActionNotice,
    requestConfirmation,
    resetInlineActionNotices,
  };
}