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

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface EmailChangeToken {
  token: string;
  userId: string;
  nextEmail: string;
  expiresAt: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}
