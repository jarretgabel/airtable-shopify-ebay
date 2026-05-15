import { AppPage } from '@/auth/pages';

export type UserRole = 'admin' | 'owner' | 'developer' | 'processor' | 'tester' | 'photographer';
export type AssignableUserRole = Exclude<UserRole, 'owner'>;

export const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'developer', label: 'Developer' },
  { value: 'processor', label: 'Processor' },
  { value: 'tester', label: 'Tester' },
  { value: 'photographer', label: 'Photographer' },
];

export const ASSIGNABLE_USER_ROLE_OPTIONS: Array<{ value: AssignableUserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'processor', label: 'Processor' },
  { value: 'tester', label: 'Tester' },
  { value: 'photographer', label: 'Photographer' },
];

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
  workflowAssignedAlertsEnabled: boolean;
  workflowUnassignedAlertsEnabled: boolean;
  workflowEvents: UsedGearWorkflowNotificationPreferences;
}

export function createDefaultUserNotificationPreferences(role: UserRole = 'processor'): UserNotificationPreferences {
  const workflowEvents = createDefaultUsedGearWorkflowNotificationPreferences();

  if (role === 'admin' || role === 'owner') {
    workflowEvents.pendingReview = true;
    workflowEvents.processing = true;
    workflowEvents.testing = true;
    workflowEvents.photography = true;
    workflowEvents.preListingReview = true;
    workflowEvents.approvedForPublish = true;
  }

  if (role === 'processor') {
    workflowEvents.pendingReview = true;
    workflowEvents.processing = true;
    workflowEvents.preListingReview = true;
    workflowEvents.approvedForPublish = true;
  }

  if (role === 'tester') {
    workflowEvents.testing = true;
  }

  if (role === 'photographer') {
    workflowEvents.photography = true;
  }

  return {
    infoEnabled: true,
    successEnabled: true,
    warningEnabled: true,
    errorEnabled: true,
    autoDismissMs: 5000,
    workflowAssignedAlertsEnabled: true,
    workflowUnassignedAlertsEnabled: true,
    workflowEvents,
  };
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = createDefaultUserNotificationPreferences('processor');

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
  role: AssignableUserRole;
  password: string;
  allowedPages: AppPage[];
}
