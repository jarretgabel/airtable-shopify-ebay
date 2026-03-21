import { create } from 'zustand';
import airtableService from '@/services/airtable';

const DEFAULT_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';

function isApprovedValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'approved';
  }

  return false;
}

interface ApprovalSummaryStoreState {
  enabled: boolean;
  loading: boolean;
  error: string | null;
  total: number;
  approved: number;
  pending: number;
  setEnabled: (enabled: boolean) => void;
  refetch: () => Promise<void>;
}

export const useApprovalSummaryStore = create<ApprovalSummaryStoreState>((set, get) => ({
  enabled: true,
  loading: true,
  error: null,
  total: 0,
  approved: 0,
  pending: 0,
  setEnabled: (enabled) => {
    set({ enabled });
    if (!enabled) {
      set({
        loading: false,
        error: null,
        total: 0,
        approved: 0,
        pending: 0,
      });
    }
  },
  refetch: async () => {
    if (!get().enabled) {
      set({ loading: false });
      return;
    }

    const tableReference = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
      || DEFAULT_TABLE_REFERENCE;
    const fallbackTableName = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
      || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim()
      || 'Table 1';

    try {
      set({ loading: true, error: null });
      const records = await airtableService.getRecordsFromReference(tableReference, fallbackTableName);
      const approvedCount = records.reduce((count, record) => {
        const approvedFieldName = Object.keys(record.fields).find((fieldName) => fieldName.toLowerCase() === 'approved');
        return count + (approvedFieldName && isApprovedValue(record.fields[approvedFieldName]) ? 1 : 0);
      }, 0);

      set({
        total: records.length,
        approved: approvedCount,
        pending: Math.max(0, records.length - approvedCount),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load approval queue' });
    } finally {
      set({ loading: false });
    }
  },
}));