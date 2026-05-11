import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUsedGearWorkflowNotifications } from '@/app/useUsedGearWorkflowNotifications';
import { useNotificationStore } from '@/stores/notificationStore';

const { loadUsedGearWorkflowNotificationSummaryMock } = vi.hoisted(() => ({
  loadUsedGearWorkflowNotificationSummaryMock: vi.fn(),
}));

vi.mock('@/services/usedGearQueue', () => ({
  createEmptyUsedGearWorkflowNotificationSummary: () => ({
    counts: {
      pendingReview: 0,
      processing: 0,
      testing: 0,
      photography: 0,
      preListingReview: 0,
      approvedForPublish: 0,
    },
    targets: {
      pendingReview: null,
      processing: null,
      testing: null,
      photography: null,
      preListingReview: null,
      approvedForPublish: null,
    },
    workflowQueueBadgeCount: 0,
  }),
  loadUsedGearWorkflowNotificationSummary: loadUsedGearWorkflowNotificationSummaryMock,
}));

describe('useUsedGearWorkflowNotifications', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    window.localStorage.clear();
    loadUsedGearWorkflowNotificationSummaryMock.mockReset();
  });

  it('opens the workflow record for actionable inventory-stage notifications and reports badge counts', async () => {
    const navigateToTab = vi.fn();
    const navigateToPath = vi.fn();
    const navigateToInventorySection = vi.fn();
    const navigateToUsedGearWorkflowRecord = vi.fn();
    const navigateToListingsRecord = vi.fn();
    const onSummaryChange = vi.fn();

    loadUsedGearWorkflowNotificationSummaryMock.mockResolvedValue({
      counts: {
        pendingReview: 1,
        processing: 0,
        testing: 0,
        photography: 0,
        preListingReview: 0,
        approvedForPublish: 0,
      },
      targets: {
        pendingReview: {
          destinationTab: 'jotform',
          recordId: null,
          sectionId: 'used-gear-pending-review',
          groupId: 'pickup:pickup-1',
          path: '/parking-lot-1?workflowPendingReviewGroup=pickup%3Apickup-1#used-gear-pending-review',
        },
        processing: null,
        testing: null,
        photography: null,
        preListingReview: null,
        approvedForPublish: null,
      },
      workflowQueueBadgeCount: 1,
    });

    renderHook(() => useUsedGearWorkflowNotifications({
      currentUser: {
        id: 'user-1',
        name: 'Taylor Reviewer',
        email: 'taylor@example.com',
        role: 'admin',
        allowedPages: [],
        notificationPreferences: {
          infoEnabled: true,
          successEnabled: true,
          warningEnabled: true,
          errorEnabled: true,
          autoDismissMs: 5000,
          workflowEvents: {
            pendingReview: true,
            processing: false,
            testing: false,
            photography: false,
            preListingReview: false,
            approvedForPublish: false,
          },
        },
      },
      canAccessPage: () => true,
      navigateToTab,
      navigateToPath,
      navigateToInventorySection,
      navigateToUsedGearWorkflowRecord,
      navigateToListingsRecord,
      enabled: true,
      onSummaryChange,
    }));

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.actionLabel).toBe('Open Queue Group');
      expect(notification?.title).toBe('Used gear pending review queue');
      notification?.onAction?.();
    });

    expect(onSummaryChange).toHaveBeenCalledWith(expect.objectContaining({ workflowQueueBadgeCount: 1 }));
    expect(navigateToPath).toHaveBeenCalledWith('/parking-lot-1?workflowPendingReviewGroup=pickup%3Apickup-1#used-gear-pending-review');
    expect(navigateToUsedGearWorkflowRecord).not.toHaveBeenCalled();
    expect(navigateToInventorySection).not.toHaveBeenCalled();
    expect(navigateToTab).not.toHaveBeenCalled();
    expect(navigateToListingsRecord).not.toHaveBeenCalled();
  });
});