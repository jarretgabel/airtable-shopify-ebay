import { AppPage } from '@/auth/pages';

export type UserRole = 'admin' | 'user';

export interface UserNotificationPreferences {
  infoEnabled: boolean;
  successEnabled: boolean;
  warningEnabled: boolean;
  errorEnabled: boolean;
  autoDismissMs: number;
}

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  infoEnabled: true,
  successEnabled: true,
  warningEnabled: true,
  errorEnabled: true,
  autoDismissMs: 5000,
};

export interface AppUser {
  id: string;
  airtableRecordId?: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
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
