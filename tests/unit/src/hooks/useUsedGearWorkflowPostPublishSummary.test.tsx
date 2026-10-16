import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUsedGearWorkflowPostPublishSummary } from '@/hooks/useUsedGearWorkflowPostPublishSummary';

const { loadQueue } = vi.hoisted(() => ({ loadQueue: vi.fn() }));
vi.mock('@/services/usedGearQueue', async () => ({
  ...await vi.importActual<typeof import('@/services/usedGearQueue')>('@/services/usedGearQueue'),
  loadWorkflowPostPublishQueue: loadQueue,
}));

describe('useUsedGearWorkflowPostPublishSummary', () => {
  beforeEach(() => loadQueue.mockReset());

  it('reports an initial failure and recovers counts on retry', async () => {
    loadQueue.mockRejectedValueOnce(new Error('Load failed')).mockResolvedValueOnce([{
      id: 'rec-active',
      createdTime: '2026-10-16',
      fields: { 'Workflow Status': 'Listed, Shopify', 'Listed At': '2099-01-01' },
    }]);
    const { result } = renderHook(() => useUsedGearWorkflowPostPublishSummary());
    await waitFor(() => expect(result.current.error).toBe('Load failed'));
    await act(() => result.current.refetch());
    expect(result.current.error).toBeNull();
    expect(result.current.activeListingCount).toBe(1);
  });

  it('retains last-successful counts with an explicit error when refresh fails', async () => {
    loadQueue.mockResolvedValueOnce([{
      id: 'rec-sold',
      createdTime: '2026-10-16',
      fields: { 'Workflow Status': 'Sold - Ready to Ship' },
    }]).mockRejectedValueOnce(new Error('Refresh failed'));
    const { result } = renderHook(() => useUsedGearWorkflowPostPublishSummary());
    await waitFor(() => expect(result.current.soldReadyCount).toBe(1));
    await act(() => result.current.refetch());
    expect(result.current.error).toBe('Refresh failed');
    expect(result.current.soldReadyCount).toBe(1);
  });
});
