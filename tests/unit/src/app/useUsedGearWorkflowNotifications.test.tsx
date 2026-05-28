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
    listingsBadgeCount: 0,
  }),
  loadUsedGearWorkflowNotificationSummary: loadUsedGearWorkflowNotificationSummaryMock,
}));

describe('useUsedGearWorkflowNotifications', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    window.localStorage.clear();
    loadUsedGearWorkflowNotificationSummaryMock.mockReset();
  });

  it('opens the operational record for actionable inventory-stage notifications and reports badge counts', async () => {
    const navigateToTab = vi.fn();
    const navigateToPath = vi.fn();
    const navigateToInventorySection = vi.fn();
    const navigateToUsedGearOperationalRecord = vi.fn();
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
          destinationTab: 'parking-lot-1',
          recordId: null,
          sectionId: 'used-gear-pending-review',
          groupId: 'pickup-1',
          path: '/parking-lot-1?workflowPendingReviewGroup=pickup-1#used-gear-pending-review',
        },
        processing: null,
        testing: null,
        photography: null,
        preListingReview: null,
        approvedForPublish: null,
      },
      workflowQueueBadgeCount: 1,
      listingsBadgeCount: 0,
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
          workflowAssignedAlertsEnabled: true,
          workflowUnassignedAlertsEnabled: false,
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
      navigateToUsedGearOperationalRecord,
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
    expect(loadUsedGearWorkflowNotificationSummaryMock).toHaveBeenCalledWith({
      currentUserName: 'Taylor Reviewer',
      includeAssignedToCurrentUser: true,
      includeUnassigned: false,
    });
    expect(navigateToPath).toHaveBeenCalledWith('/parking-lot-1?workflowPendingReviewGroup=pickup-1#used-gear-pending-review');
    expect(navigateToUsedGearOperationalRecord).not.toHaveBeenCalled();
    expect(navigateToInventorySection).not.toHaveBeenCalled();
    expect(navigateToTab).not.toHaveBeenCalled();
    expect(navigateToListingsRecord).not.toHaveBeenCalled();
  });

  it('dismisses workflow notifications when both ownership filters are disabled', async () => {
    loadUsedGearWorkflowNotificationSummaryMock.mockResolvedValue({
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
      listingsBadgeCount: 0,
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
          workflowAssignedAlertsEnabled: false,
          workflowUnassignedAlertsEnabled: false,
          workflowEvents: {
            pendingReview: true,
            processing: true,
            testing: true,
            photography: true,
            preListingReview: true,
            approvedForPublish: true,
          },
        },
      },
      canAccessPage: () => true,
      navigateToTab: vi.fn(),
      navigateToPath: vi.fn(),
      navigateToInventorySection: vi.fn(),
      navigateToUsedGearOperationalRecord: vi.fn(),
      navigateToListingsRecord: vi.fn(),
      enabled: true,
    }));

    await waitFor(() => {
      expect(loadUsedGearWorkflowNotificationSummaryMock).toHaveBeenCalledWith({
        currentUserName: 'Taylor Reviewer',
        includeAssignedToCurrentUser: false,
        includeUnassigned: false,
      });
    });
  });

  it('opens the Listings record for listing review notifications', async () => {
    const navigateToListingsRecord = vi.fn();

    loadUsedGearWorkflowNotificationSummaryMock.mockResolvedValue({
      counts: {
        pendingReview: 0,
        processing: 0,
        testing: 0,
        photography: 0,
        preListingReview: 1,
        approvedForPublish: 0,
      },
      targets: {
        pendingReview: null,
        processing: null,
        testing: null,
        photography: null,
        preListingReview: {
          destinationTab: 'listings',
          recordId: 'rec-listing-review',
          sectionId: null,
          groupId: null,
          path: null,
        },
        approvedForPublish: null,
      },
      workflowQueueBadgeCount: 1,
      listingsBadgeCount: 1,
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
          workflowAssignedAlertsEnabled: true,
          workflowUnassignedAlertsEnabled: true,
          workflowEvents: {
            pendingReview: false,
            processing: false,
            testing: false,
            photography: false,
            preListingReview: true,
            approvedForPublish: false,
          },
        },
      },
      canAccessPage: () => true,
      navigateToTab: vi.fn(),
      navigateToPath: vi.fn(),
      navigateToInventorySection: vi.fn(),
      navigateToUsedGearOperationalRecord: vi.fn(),
      navigateToListingsRecord,
      enabled: true,
    }));

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.title).toBe('Used gear listing review queue');
      expect(notification?.actionLabel).toBe('Open Listing Record');
      notification?.onAction?.();
    });

    expect(navigateToListingsRecord).toHaveBeenCalledWith('rec-listing-review');
  });

  it('opens Listings for approved-for-publish notifications when the user keeps that event enabled', async () => {
    const navigateToTab = vi.fn();

    loadUsedGearWorkflowNotificationSummaryMock.mockResolvedValue({
      counts: {
        pendingReview: 0,
        processing: 0,
        testing: 0,
        photography: 0,
        preListingReview: 0,
        approvedForPublish: 2,
      },
      targets: {
        pendingReview: null,
        processing: null,
        testing: null,
        photography: null,
        preListingReview: null,
        approvedForPublish: {
          destinationTab: 'listings',
          recordId: null,
          sectionId: null,
          groupId: null,
          path: null,
        },
      },
      workflowQueueBadgeCount: 0,
      listingsBadgeCount: 2,
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
          workflowAssignedAlertsEnabled: true,
          workflowUnassignedAlertsEnabled: true,
          workflowEvents: {
            pendingReview: false,
            processing: false,
            testing: false,
            photography: false,
            preListingReview: false,
            approvedForPublish: true,
          },
        },
      },
      canAccessPage: () => true,
      navigateToTab,
      navigateToPath: vi.fn(),
      navigateToInventorySection: vi.fn(),
      navigateToUsedGearOperationalRecord: vi.fn(),
      navigateToListingsRecord: vi.fn(),
      enabled: true,
    }));

    await waitFor(() => {
      const notification = useNotificationStore.getState().notifications[0];
      expect(notification?.title).toBe('Used gear approved for publish');
      expect(notification?.actionLabel).toBe('Open Listings');
      notification?.onAction?.();
    });

    expect(navigateToTab).toHaveBeenCalledWith('listings');
  });
});