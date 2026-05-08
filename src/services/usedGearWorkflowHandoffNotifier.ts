import type { AppUser } from '@/stores/auth/authTypes';
import type { NotificationTone } from '@/stores/notificationStore';
import type { AirtableRecord } from '@/types/airtable';
import {
  buildUsedGearStageHandoffNotification,
  type UsedGearCompletedStage,
} from '@/services/usedGearWorkflowStageNotifications';

interface UpsertNotificationInput {
  tone: NotificationTone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissible?: boolean;
}

interface PublishUsedGearStageHandoffNotificationParams {
  currentUser: AppUser | null;
  completedStage: UsedGearCompletedStage;
  record: AirtableRecord;
  onOpenWorkflowRecord: (recordId: string) => void;
  upsertByKey: (key: string, input: UpsertNotificationInput) => string;
}

export function publishUsedGearStageHandoffNotification({
  currentUser,
  completedStage,
  record,
  onOpenWorkflowRecord,
  upsertByKey,
}: PublishUsedGearStageHandoffNotificationParams): boolean {
  const notification = buildUsedGearStageHandoffNotification({
    completedStage,
    currentUser,
    record,
  });

  if (!notification) {
    return false;
  }

  upsertByKey(notification.digestKey ?? notification.key, {
    tone: notification.tone,
    title: notification.title,
    message: notification.message,
    actionLabel: 'Open Workflow Record',
    onAction: () => onOpenWorkflowRecord(record.id),
    dismissible: true,
  });

  return true;
}