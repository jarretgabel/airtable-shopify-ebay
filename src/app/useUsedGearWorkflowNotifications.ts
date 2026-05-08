import { useEffect } from 'react';
import type { Tab } from '@/app/appNavigation';
import { loadUsedGearWorkflowNotificationCounts } from '@/services/usedGearQueue';
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
  enabled: boolean;
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
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} awaiting intake review in Inventory.`,
      };
    case 'processing':
      return {
        tone: 'info' as const,
        title: 'Used gear processing queue',
        message: `${pluralize(count, 'row')} ${count === 1 ? 'is' : 'are'} waiting for processing handoff.`,
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

export function useUsedGearWorkflowNotifications({
  currentUser,
  canAccessPage,
  navigateToTab,
  enabled,
}: UsedGearWorkflowNotificationParams): void {
  const upsertByKey = useNotificationStore((state) => state.upsertByKey);
  const dismissByKey = useNotificationStore((state) => state.dismissByKey);
  const workflowPreferenceSignature = USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS
    .map((option) => `${option.key}:${currentUser?.notificationPreferences.workflowEvents[option.key] ? '1' : '0'}`)
    .join('|');

  useEffect(() => {
    if (!enabled || !currentUser || !canAccessPage('inventory')) {
      USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.forEach((option) => {
        dismissByKey(WORKFLOW_NOTIFICATION_KEYS[option.key]);
      });
      return;
    }

    let cancelled = false;

    const syncNotifications = async () => {
      try {
        const counts = await loadUsedGearWorkflowNotificationCounts();
        if (cancelled) {
          return;
        }

        USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS.forEach((option) => {
          const isEnabled = currentUser.notificationPreferences.workflowEvents[option.key];
          const count = counts[option.key];
          const notificationKey = WORKFLOW_NOTIFICATION_KEYS[option.key];

          if (!isEnabled || count <= 0) {
            dismissByKey(notificationKey);
            return;
          }

          const copy = buildNotificationCopy(option.key, count);
          upsertByKey(notificationKey, {
            tone: copy.tone,
            title: copy.title,
            message: copy.message,
            actionLabel: option.key === 'approvedForPublish' ? 'Open Listings' : 'Open Inventory',
            onAction: () => navigateToTab(option.key === 'approvedForPublish' ? 'listings' : 'inventory'),
            dismissible: true,
          });
        });
      } catch {
        if (cancelled) {
          return;
        }

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
  }, [canAccessPage, currentUser, dismissByKey, enabled, navigateToTab, upsertByKey, workflowPreferenceSignature]);
}