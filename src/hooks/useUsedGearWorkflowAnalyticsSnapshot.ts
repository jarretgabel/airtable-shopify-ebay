import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyUsedGearWorkflowAnalyticsSnapshot,
  loadUsedGearWorkflowAnalyticsSnapshot,
  type UsedGearWorkflowAnalyticsSnapshot,
} from '@/services/usedGearWorkflowAnalytics';

export interface UsedGearWorkflowAnalyticsSnapshotState extends UsedGearWorkflowAnalyticsSnapshot {
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_SNAPSHOT = createEmptyUsedGearWorkflowAnalyticsSnapshot();

export function useUsedGearWorkflowAnalyticsSnapshot(enabled = true): UsedGearWorkflowAnalyticsSnapshotState {
  const [snapshot, setSnapshot] = useState<UsedGearWorkflowAnalyticsSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setSnapshot(EMPTY_SNAPSHOT);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setSnapshot(await loadUsedGearWorkflowAnalyticsSnapshot());
    } catch (loadError) {
      setSnapshot(EMPTY_SNAPSHOT);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the used-gear workflow analytics snapshot.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...snapshot,
    loading,
    error,
    refetch,
  };
}