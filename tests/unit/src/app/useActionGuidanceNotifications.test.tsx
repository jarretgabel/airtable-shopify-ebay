import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActionGuidanceNotifications } from '@/app/useActionGuidanceNotifications';
import { useNotificationStore } from '@/stores/notificationStore';

describe('useActionGuidanceNotifications', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    window.localStorage.clear();
  });

  it('publishes used-gear stale and sold-ready notifications for inventory operators', async () => {
    const navigateToTab = vi.fn();
    const navigateToInventoryPostPublishBucket = vi.fn();

    renderHook(() => useActionGuidanceNotifications({
      canAccessPage: () => true,
      navigateToTab,
      navigateToInventoryPostPublishBucket,
      onRefresh: vi.fn(),
      approvalPending: 0,
      shopifyApprovalPending: 0,
      totalNewSubmissions: 0,
      ebayAuthenticated: true,
      workflowPostPublishStaleListingCount: 2,
      workflowPostPublishSoldReadyCount: 1,
      atError: null,
      workflowError: null,
      spError: null,
      jfError: null,
      ebayError: null,
    }));

    await waitFor(() => {
      const notifications = useNotificationStore.getState().notifications;
      expect(notifications).toHaveLength(2);
    });

    const notifications = useNotificationStore.getState().notifications;
    expect(notifications.map((notification) => notification.key)).toEqual([
      'guidance-used-gear-stale-listings',
      'guidance-used-gear-sold-ready',
    ]);
    expect(notifications[0]?.message).toContain('2 used-gear listings');
    expect(notifications[1]?.message).toContain('1 used-gear item');

    notifications[0]?.onAction?.();
    notifications[1]?.onAction?.();

    expect(navigateToInventoryPostPublishBucket).toHaveBeenNthCalledWith(1, 'stale-listing');
    expect(navigateToInventoryPostPublishBucket).toHaveBeenNthCalledWith(2, 'sold-ready');
  });
});