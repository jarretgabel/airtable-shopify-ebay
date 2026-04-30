import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useApprovalSummaryStore } from '@/stores/approval/approvalSummaryStore';

interface ApprovalQueueSummaryState {
  loading: boolean;
  error: string | null;
  total: number;
  approved: number;
  pending: number;
  refetch: () => Promise<void>;
}

export function useApprovalQueueSummary(enabled = true): ApprovalQueueSummaryState {
  const selector = useShallow((state: ReturnType<typeof useApprovalSummaryStore.getState>) => ({
    loading: state.loading,
    error: state.error,
    total: state.total,
    approved: state.approved,
    pending: state.pending,
    setEnabled: state.setEnabled,
    refetch: state.refetch,
  }));

  const {
    loading,
    error,
    total,
    approved,
    pending,
    setEnabled,
    refetch,
  } = useApprovalSummaryStore(selector);

  useEffect(() => {
    setEnabled(enabled);
    if (!enabled) return;
    void refetch(false);
  }, [enabled, setEnabled, refetch]);

  return { loading, error, total, approved, pending, refetch };
}