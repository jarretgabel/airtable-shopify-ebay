import { AirtableRecord } from '@/types/airtable';
import type { ApprovalFieldKind } from '@/stores/approval/approvalStoreFieldUtils';

export interface ApprovalStore {
  records: AirtableRecord[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  listingFormatOptions: string[];
  formValues: Record<string, string>;
  fieldKinds: Record<string, ApprovalFieldKind>;

  setFormValue: (fieldName: string, value: string) => void;
  hydrateForm: (record: AirtableRecord, allFieldNames: string[], approvedFieldName: string) => void;
  loadRecords: (tableReference: string, fallbackTableName: string) => Promise<void>;
  loadListingFormatOptions: () => Promise<void>;
  saveRecord: (
    forceApproved: boolean,
    selectedRecord: AirtableRecord,
    tableReference: string,
    fallbackTableName: string,
    approvedFieldName: string,
    onSuccess: () => void,
  ) => Promise<void>;
}