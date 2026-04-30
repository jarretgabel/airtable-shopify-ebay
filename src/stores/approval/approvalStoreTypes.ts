import { AirtableRecord } from '@/types/airtable';
import type { ApprovalFieldKind } from '@/stores/approval/approvalStoreFieldUtils';

export interface ApprovalStore {
  records: AirtableRecord[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  listingFormatOptions: string[];
  listingDurationOptions: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, ApprovalFieldKind>;

  setFormValue: (fieldName: string, value: string) => void;
  hydrateForm: (record: AirtableRecord, allFieldNames: string[], approvedFieldName: string) => void;
  loadRecords: (tableReference: string, tableName?: string, force?: boolean) => Promise<void>;
  loadListingFormatOptions: (force?: boolean) => Promise<void>;
  saveRecord: (
    forceApproved: boolean,
    selectedRecord: AirtableRecord,
    tableReference: string,
    tableName: string | undefined,
    actualFieldNames: string[],
    approvedFieldName: string,
    onSuccess: () => void,
    mode?: 'full' | 'approve-only',
  ) => Promise<boolean>;
}