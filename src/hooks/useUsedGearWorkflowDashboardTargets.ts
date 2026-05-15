import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyUsedGearWorkflowDashboardTargets,
  loadUsedGearWorkflowDashboardTargets,
  type UsedGearWorkflowDashboardTargets,
} from '@/services/usedGearWorkflowDashboardTargets';

export interface UsedGearWorkflowDashboardTargetsState extends UsedGearWorkflowDashboardTargets {
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_TARGETS = createEmptyUsedGearWorkflowDashboardTargets();

export function useUsedGearWorkflowDashboardTargets(enabled = true): UsedGearWorkflowDashboardTargetsState {
  const [targets, setTargets] = useState<UsedGearWorkflowDashboardTargets>(EMPTY_TARGETS);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setTargets(EMPTY_TARGETS);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setTargets(await loadUsedGearWorkflowDashboardTargets());
    } catch (loadError) {
      setTargets(EMPTY_TARGETS);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load workflow dashboard targets.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...targets,
    loading,
    error,
    refetch,
  };
}