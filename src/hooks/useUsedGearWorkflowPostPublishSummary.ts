import { useCallback, useEffect, useState } from 'react';
import {
  createEmptyUsedGearWorkflowPostPublishSummary,
  loadWorkflowPostPublishQueue,
  summarizeUsedGearWorkflowPostPublishQueue,
  type UsedGearWorkflowPostPublishSummary,
} from '@/services/usedGearQueue';

interface UsedGearWorkflowPostPublishSummaryState extends UsedGearWorkflowPostPublishSummary {
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const EMPTY_SUMMARY = createEmptyUsedGearWorkflowPostPublishSummary();

export function useUsedGearWorkflowPostPublishSummary(enabled = true): UsedGearWorkflowPostPublishSummaryState {
  const [summary, setSummary] = useState<UsedGearWorkflowPostPublishSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const records = await loadWorkflowPostPublishQueue();
      setSummary(summarizeUsedGearWorkflowPostPublishQueue(records));
    } catch (loadError) {
      setSummary(EMPTY_SUMMARY);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load used-gear post-publish workflow counts.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    ...summary,
    loading,
    error,
    refetch,
  };
}