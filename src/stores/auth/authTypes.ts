import { AppPage } from '@/auth/pages';

export type UserRole = 'admin' | 'user';

export const USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS = [
  {
    key: 'pendingReview',
    label: 'Pending review queue',
    description: 'Rows waiting for initial purchasing review.',
  },
  {
    key: 'processing',
    label: 'Processing queue',
    description: 'Accepted rows waiting for processing handoff.',
  },
  {
    key: 'testing',
    label: 'Testing stage',
    description: 'Rows waiting for testing signoff.',
  },
  {
    key: 'photography',
    label: 'Photography stage',
    description: 'Rows waiting for photography signoff.',
  },
  {
    key: 'preListingReview',
    label: 'Pre-listing review',
    description: 'Rows ready for pre-listing review approval.',
  },
  {
    key: 'approvedForPublish',
    label: 'Approved for publish',
    description: 'Rows cleared for listing and publish readiness.',
  },
] as const;

export type UsedGearWorkflowNotificationEvent = (typeof USED_GEAR_WORKFLOW_NOTIFICATION_EVENT_OPTIONS)[number]['key'];

export type UsedGearWorkflowNotificationPreferences = Record<UsedGearWorkflowNotificationEvent, boolean>;

export function createDefaultUsedGearWorkflowNotificationPreferences(): UsedGearWorkflowNotificationPreferences {
  return {
    pendingReview: false,
    processing: false,
    testing: false,
    photography: false,
    preListingReview: false,
    approvedForPublish: false,
  };
}

export interface UserNotificationPreferences {
  infoEnabled: boolean;
  successEnabled: boolean;
  warningEnabled: boolean;
  errorEnabled: boolean;
  autoDismissMs: number;
  workflowEvents: UsedGearWorkflowNotificationPreferences;
}

export function createDefaultUserNotificationPreferences(): UserNotificationPreferences {
  return {
    infoEnabled: true,
    successEnabled: true,
    warningEnabled: true,
    errorEnabled: true,
    autoDismissMs: 5000,
    workflowEvents: createDefaultUsedGearWorkflowNotificationPreferences(),
  };
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = createDefaultUserNotificationPreferences();

export interface AppUser {
  id: string;
  airtableRecordId?: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  mustChangePassword?: boolean;
  allowedPages: AppPage[];
  notificationPreferences: UserNotificationPreferences;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}
