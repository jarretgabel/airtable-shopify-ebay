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
    label: 'Intake review queue',
    description: 'Rows waiting in Parking Lot 1 for initial purchasing review.',
  },
  {
    key: 'processing',
    label: 'Processing and holding queue',
    description: 'Accepted rows waiting across arrival, processing, and shared stage work before Listings.',
  },
  {
    key: 'testing',
    label: 'Testing queue',
    description: 'Rows still waiting for testing signoff in the shared stage.',
  },
  {
    key: 'photography',
    label: 'Photography queue',
    description: 'Rows still waiting for photography signoff in the shared stage.',
  },
  {
    key: 'preListingReview',
    label: 'Listings pre-listing review',
    description: 'Rows that have cleared processing and are now ready in Listings for final review.',
  },
  {
    key: 'approvedForPublish',
    label: 'Listings approved for publish',
    description: 'Rows already approved in Listings and ready for channel listing work.',
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
