import type { ListingApprovalSelectedRecordPanelProps } from '@/components/approval/ListingApprovalSelectedRecordPanel';
import type { buildListingApprovalSelectedRecordStatusProps } from '@/components/approval/listingApprovalSelectedRecordStatusProps';
import type { buildListingApprovalSelectedRecordViewProps } from '@/components/approval/listingApprovalSelectedRecordViewProps';
import type { AirtableRecord } from '@/types/airtable';

interface BuildListingApprovalSelectedRecordPanelPropsParams {
  selectedRecord: AirtableRecord | null;
  titleFieldName: string;
  isApproved: boolean;
  saving: boolean;
  error: string | null;
  onBackToList: () => void;
  secondaryActionButtonClass: string;
  errorSurfaceClass: string;
  isCombinedApproval: boolean;
  selectedRecordViewProps: ReturnType<typeof buildListingApprovalSelectedRecordViewProps> | null;
  selectedRecordStatusProps: ReturnType<typeof buildListingApprovalSelectedRecordStatusProps> | null;
}

export function buildListingApprovalSelectedRecordPanelProps({
  selectedRecord,
  titleFieldName,
  isApproved,
  saving,
  error,
  onBackToList,
  secondaryActionButtonClass,
  errorSurfaceClass,
  isCombinedApproval,
  selectedRecordViewProps,
  selectedRecordStatusProps,
}: BuildListingApprovalSelectedRecordPanelPropsParams): ListingApprovalSelectedRecordPanelProps | null {
  if (!selectedRecord || !selectedRecordViewProps || !selectedRecordStatusProps) {
    return null;
  }

  return {
    selectedRecord,
    titleFieldName,
    isApproved,
    saving,
    error,
    onBackToList,
    secondaryActionButtonClass,
    errorSurfaceClass,
    isCombinedApproval,
    selectedRecordViewProps,
    selectedRecordStatusProps,
  };
}