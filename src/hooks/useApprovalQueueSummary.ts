import { useCallback, useEffect, useState } from 'react';
import airtableService from '@/services/airtable';

interface ApprovalQueueSummaryState {
  loading: boolean;
  error: string | null;
  total: number;
  approved: number;
  pending: number;
  refetch: () => Promise<void>;
}

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

export function useApprovalQueueSummary(enabled = true): ApprovalQueueSummaryState {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [approved, setApproved] = useState(0);
  const [pending, setPending] = useState(0);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const tableReference = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_REF as string | undefined)?.trim()
      || DEFAULT_TABLE_REFERENCE;
    const fallbackTableName = (import.meta.env.VITE_AIRTABLE_APPROVAL_TABLE_NAME as string | undefined)?.trim()
      || (import.meta.env.VITE_AIRTABLE_TABLE_NAME as string | undefined)?.trim()
      || 'Table 1';

    try {
      setLoading(true);
      setError(null);
      const records = await airtableService.getRecordsFromReference(tableReference, fallbackTableName);
      const approvedCount = records.reduce((count, record) => {
        const approvedFieldName = Object.keys(record.fields).find((fieldName) => fieldName.toLowerCase() === 'approved');
        return count + (approvedFieldName && isApprovedValue(record.fields[approvedFieldName]) ? 1 : 0);
      }, 0);

      setTotal(records.length);
      setApproved(approvedCount);
      setPending(Math.max(0, records.length - approvedCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setTotal(0);
      setApproved(0);
      setPending(0);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return { loading, error, total, approved, pending, refetch };
}