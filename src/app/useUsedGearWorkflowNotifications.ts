import { useEffect } from 'react';
import type { Tab } from '@/app/appNavigation';
import {
  createEmptyUsedGearWorkflowNotificationSummary,
  loadUsedGearWorkflowNotificationSummary,
  type UsedGearWorkflowNotificationSummary,
  type UsedGearWorkflowNotificationTarget,
} from '@/services/usedGearQueue';
import {
  USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS,
  type AppUser,
  type UsedGearWorkflowNotificationEvent,
} from '@/stores/auth/authTypes';
import { useNotificationStore } from '@/stores/notificationStore';

interface UsedGearWorkflowNotificationParams {
  currentUser: AppUser | null;
  canAccessPage: (tab: Tab) => boolean;
  navigateToTab: (tab: Tab, replace?: boolean) => void;
  navigateToPath: (path: string, replace?: boolean) => void;
  navigateToInventorySection: (sectionId: string, replace?: boolean) => void;
  navigateToUsedGearWorkflowRecord: (recordId: string, replace?: boolean) => void;
  navigateToListingsRecord: (recordId: string, replace?: boolean) => void;
  enabled: boolean;
  onSummaryChange?: (summary: UsedGearWorkflowNotificationSummary) => void;
}

const WORKFLOW_NOTIFICATION_KEYS: Record<UsedGearWorkflowNotificationEvent, string> = {
  pendingReview: 'used-gear-pending-review',
  processing: 'used-gear-processing',
  testing: 'used-gear-testing',
  photography: 'used-gear-photography',
  preListingReview: 'used-gear-pre-listing',
  approvedForPublish: 'used-gear-approved-for-publish',
};

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function buildNotificationCopy(eventKey: UsedGearWorkflowNotificationEvent, count: number) {
  switch (eventKey) {
    case 'pendingReview':
      return {
        tone: 'warning' as const,
        title: 'Used gear pending review queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} awaiting intake review in Parking Lot 1.`,
      };
    case 'processing':
      return {
        tone: 'info' as const,
        title: 'Used gear processing queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} waiting in Parking Lot 2 for arrival-stage handling.`,
      };
    case 'testing':
      return {
        tone: 'info' as const,
        title: 'Used gear testing queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} still waiting for testing completion.`,
      };
    case 'photography':
      return {
        tone: 'info' as const,
        title: 'Used gear photography queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} still waiting for photography completion.`,
      };
    case 'preListingReview':
      return {
        tone: 'warning' as const,
        title: 'Used gear pre-listing review queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} ready for pre-listing review.`,
      };
    case 'approvedForPublish':
      return {
        tone: 'success' as const,
        title: 'Used gear approved for publish',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} approved and ready for listing work.`,
      };
  }
}

function buildNotificationAction(
  eventKey: UsedGearWorkflowNotificationEvent,
  target: UsedGearWorkflowNotificationTarget | null,
  navigateToTab: (tab: Tab, replace?: boolean) => void,
  navigateToPath: (path: string, replace?: boolean) => void,
  navigateToInventorySection: (sectionId: string, replace?: boolean) => void,
  navigateToUsedGearWorkflowRecord: (recordId: string, replace?: boolean) => void,
  navigateToListingsRecord: (recordId: string, replace?: boolean) => void,
) {
  if (target?.path) {
    const targetPath = target.path;
    return {
      actionLabel: target.groupId ? 'Open Queue Group' : 'Open Queue Section',
      onAction: () => navigateToPath(targetPath),
    };
  }

  if (target?.destinationTab === 'listings' && target.recordId) {
    const recordId = target.recordId;
    return {
      actionLabel: 'Open Listing Record',
      onAction: () => navigateToListingsRecord(recordId),
    };
  }

  if (target?.destinationTab === 'inventory' && target.recordId) {
    const recordId = target.recordId;
    return {
      actionLabel: 'Open Workflow Record',
      onAction: () => navigateToUsedGearWorkflowRecord(recordId),
    };
  }

  if (target?.destinationTab === 'inventory' && target.sectionId) {
    const sectionId = target.sectionId;
    return {
      actionLabel: 'Open Queue Section',
      onAction: () => navigateToInventorySection(sectionId),
    };
  }

  if (eventKey === 'pendingReview') {
    return {
      actionLabel: 'Open Parking Lot 1',
      onAction: () => navigateToTab('parking-lot-1'),
    };
  }

  if (eventKey === 'processing') {
    return {
      actionLabel: 'Open Parking Lot 2',
      onAction: () => navigateToTab('parking-lot-2'),
    };
  }

  if (eventKey === 'testing') {
    return {
      actionLabel: 'Open Testing Queue',
      onAction: () => navigateToTab('testing-queue'),
    };
  }

  if (eventKey === 'photography') {
    return {
      actionLabel: 'Open Photography Queue',
      onAction: () => navigateToTab('photography-queue'),
    };
  }

  if (eventKey === 'preListingReview') {
    return {
      actionLabel: 'Open Pre-Listing Queue',
      onAction: () => navigateToTab('pre-listing-queue'),
    };
  }

  return eventKey === 'approvedForPublish'
    ? { actionLabel: 'Open Listings', onAction: () => navigateToTab('listings') }
    : { actionLabel: 'Open Inventory', onAction: () => navigateToTab('inventory') };
}

export function useUsedGearWorkflowNotifications({
  currentUser,
  canAccessPage,
  navigateToTab,
  navigateToPath,
  navigateToInventorySection,
  navigateToUsedGearWorkflowRecord,
  navigateToListingsRecord,
  enabled,
  onSummaryChange,
}: UsedGearWorkflowNotificationParams): void {
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const dismissByKey = useNotificationStore((state) => state.dismissByKey);
  const canAccessWorkflowSurfaces = canAccessPage('parking-lot-1')
    || canAccessPage('parking-lot-2')
    || canAccessPage('inventory')
    || canAccessPage('testing-queue')
    || canAccessPage('photography-queue')
    || canAccessPage('pre-listing-queue')
    || canAccessPage('listings');
  const workflowPreferenceSignature = USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS
    .map((option) => `${option.key}:${currentUser?.notificationPreferences.workflowEvents[option.key] ? '1' : '0'}`)
    .join('|');
  const workflowOwnershipPreferenceSignature = currentUser
    ? `${currentUser.notificationPreferences.workflowAssignedAlertsEnabled ? '1' : '0'}:${currentUser.notificationPreferences.workflowUnassignedAlertsEnabled ? '1' : '0'}`
    : '0:0';

  useEffect(() => {
    if (!enabled || !currentUser || !canAccessWorkflowSurfaces) {
      onSummaryChange?.(createEmptyUsedGearWorkflowNotificationSummary());
      USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.forEach((option) => {
        dismissByKey(WORKFLOW_NOTIFICATION_KEYS[option.key]);
      });
      return;
    }

    let cancelled = false;

    const syncNotifications = async () => {
      try {
        const summary = await loadUsedGearWorkflowNotificationSummary({
          currentUserName: currentUser.name,
          includeAssignedToCurrentUser: currentUser.notificationPreferences.workflowAssignedAlertsEnabled,
          includeUnassigned: currentUser.notificationPreferences.workflowUnassignedAlertsEnabled,
        });
        if (cancelled) {
          return;
        }

        onSummaryChange?.(summary);

        USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.forEach((option) => {
          const isEnabled = currentUser.notificationPreferences.workflowEvents[option.key];
          const count = summary.counts[option.key];
          const notificationKey = WORKFLOW_NOTIFICATION_KEYS[option.key];

          if (!isEnabled || count <= 0) {
            dismissByKey(notificationKey);
            return;
          }

          const copy = buildNotificationCopy(option.key, count);
          const action = buildNotificationAction(
            option.key,
            summary.targets[option.key],
            navigateToTab,
            navigateToPath,
            navigateToInventorySection,
            navigateToUsedGearWorkflowRecord,
            navigateToListingsRecord,
          );
          upsertByKey(notificationKey, {
            tone: copy.tone,
            title: copy.title,
            message: copy.message,
            actionLabel: action.actionLabel,
            onAction: action.onAction,
            dismissible: true,
          });
        });
      } catch {
        if (cancelled) {
          return;
        }

        onSummaryChange?.(createEmptyUsedGearWorkflowNotificationSummary());

        USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.forEach((option) => {
          dismissByKey(WORKFLOW_NOTIFICATION_KEYS[option.key]);
        });
      }
    };

    void syncNotifications();

    const intervalId = window.setInterval(() => {
      void syncNotifications();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canAccessWorkflowSurfaces, currentUser, dismissByKey, enabled, navigateToInventorySection, navigateToListingsRecord, navigateToPath, navigateToTab, navigateToUsedGearWorkflowRecord, onSummaryChange, upsertByKey, workflowOwnershipPreferenceSignature, workflowPreferenceSignature]);
}