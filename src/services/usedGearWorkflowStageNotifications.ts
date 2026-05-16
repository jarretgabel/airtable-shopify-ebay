import type { AppUser, UsedGearWorkflowNotificationEvent } from '@/stores/auth/authTypes';
import type { NotificationTone } from '@/stores/notificationStore';
import type { AirtableRecord } from '@/types/airtable';
import {
  buildUsedGearConcurrentStageSignoffs,
  deriveUsedGearNextTeams,
  getUsedGearWorkflowStatus,
} from '@/services/usedGearWorkflow';

export type UsedGearCompletedStage = 'processing' | 'testing' | 'photography';

interface UsedGearStageHandoffNotification {
  key: string;
  digestKey?: string;
  tone: NotificationTone;
  title: string;
  message: string;
}

interface BuildUsedGearStageHandoffNotificationParams {
  completedStage: UsedGearCompletedStage;
  currentUser: AppUser | null;
  record: AirtableRecord;
}

function getTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getOperationalRecordLabel(record: AirtableRecord): string {
  const sku = getTrimmedString(record.fields.SKU);
  const make = getTrimmedString(record.fields.Make);
  const model = getTrimmedString(record.fields.Model);
  const makeModel = [make, model].filter(Boolean).join(' ');

  if (sku && makeModel) {
    return `${sku} (${makeModel})`;
  }

  if (sku) {
    return sku;
  }

  if (makeModel) {
    return makeModel;
  }

  return `operational record ${record.id}`;
}

function areAnyWorkflowEventsEnabled(
  currentUser: AppUser,
  eventKeys: UsedGearWorkflowNotificationEvent[],
): boolean {
  return eventKeys.some((eventKey) => currentUser.notificationPreferences.workflowEvents[eventKey]);
}

export function buildUsedGearStageHandoffNotification({
  completedStage,
  currentUser,
  record,
}: BuildUsedGearStageHandoffNotificationParams): UsedGearStageHandoffNotification | null {
  if (!currentUser) {
    return null;
  }

  const status = getUsedGearWorkflowStatus(record.fields);
  if (!status) {
    return null;
  }

  const signoffs = buildUsedGearConcurrentStageSignoffs(record.fields);
  const nextTeams = deriveUsedGearNextTeams(status, signoffs);
  const recordLabel = getOperationalRecordLabel(record);

  if (status === 'Testing and Photography In Progress') {
    if (nextTeams.includes('Testing') && nextTeams.includes('Photography')) {
      const eventKeys: UsedGearWorkflowNotificationEvent[] = ['testing', 'photography'];
      if (!areAnyWorkflowEventsEnabled(currentUser, eventKeys)) {
        return null;
      }

      return {
        key: `used-gear-stage-handoff:${record.id}:${completedStage}`,
        digestKey: 'used-gear-stage-handoff:testing-photography',
        tone: 'info',
        title: 'Processing complete: testing and photography next',
        message: `${recordLabel} is ready for concurrent testing and photography work.`,
      };
    }

    if (nextTeams.length === 1 && nextTeams[0] === 'Testing') {
      const eventKeys: UsedGearWorkflowNotificationEvent[] = ['testing'];
      if (!areAnyWorkflowEventsEnabled(currentUser, eventKeys)) {
        return null;
      }

      return {
        key: `used-gear-stage-handoff:${record.id}:${completedStage}`,
        digestKey: 'used-gear-stage-handoff:testing-only',
        tone: 'info',
        title: 'Photography complete: testing next',
        message: `${recordLabel} is now waiting only on testing completion.`,
      };
    }

    if (nextTeams.length === 1 && nextTeams[0] === 'Photography') {
      const eventKeys: UsedGearWorkflowNotificationEvent[] = ['photography'];
      if (!areAnyWorkflowEventsEnabled(currentUser, eventKeys)) {
        return null;
      }

      return {
        key: `used-gear-stage-handoff:${record.id}:${completedStage}`,
        digestKey: 'used-gear-stage-handoff:photography-only',
        tone: 'info',
        title: 'Testing complete: photography next',
        message: `${recordLabel} is now waiting only on photography completion.`,
      };
    }
  }

  if (status === 'Awaiting Pre-Listing Review') {
    const eventKeys: UsedGearWorkflowNotificationEvent[] = ['preListingReview'];
    if (!areAnyWorkflowEventsEnabled(currentUser, eventKeys)) {
      return null;
    }

    return {
      key: `used-gear-stage-handoff:${record.id}:${completedStage}`,
      digestKey: 'used-gear-stage-handoff:pre-listing-review',
      tone: 'warning',
      title: 'Stage handoff complete: pre-listing review next',
      message: `${recordLabel} cleared testing and photography and is ready for pre-listing review.`,
    };
  }

  return null;
}