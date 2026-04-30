import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useShopifyApprovalSummaryStore } from '@/stores/approval/shopifyApprovalSummaryStore';

interface ShopifyApprovalQueueSummaryState {
  loading: boolean;
  error: string | null;
  total: number;
  approved: number;
  pending: number;
  refetch: () => Promise<void>;
}

export function useShopifyApprovalQueueSummary(enabled = true): ShopifyApprovalQueueSummaryState {
  const selector = useShallow((state: ReturnType<typeof useShopifyApprovalSummaryStore.getState>) => ({
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
  } = useShopifyApprovalSummaryStore(selector);

  useEffect(() => {
    setEnabled(enabled);
    if (!enabled) return;
    void refetch(false);
  }, [enabled, setEnabled, refetch]);

  return { loading, error, total, approved, pending, refetch };
}
