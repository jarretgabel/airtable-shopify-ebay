import { APP_PAGES, AppPage } from '@/auth/pages';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser, type EmailChangeToken, type PasswordResetToken, type UserNotificationPreferences, type UserRole } from './authTypes';

export const USERS_KEY = 'listing-control-center.users';
export const SESSION_KEY = 'listing-control-center.session';
export const RESET_KEY = 'listing-control-center.reset-tokens';
export const EMAIL_CHANGE_KEY = 'listing-control-center.email-change-tokens';

const defaultUsers: AppUser[] = [
  {
    id: 'u-admin',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    password: 'Admin123!',
    allowedPages: [...APP_PAGES],
    notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
  },
  {
    id: 'u-operator',
    name: 'Operations User',
    email: 'operator@example.com',
    role: 'user',
    password: 'User123!',
    allowedPages: ['dashboard', 'airtable', 'shopify', 'jotform', 'approval', 'notifications'],
    notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
  },
];

function isAppPage(value: string): value is AppPage {
  return APP_PAGES.includes(value as AppPage);
}

export function normalizePages(pages: AppPage[], role: UserRole): AppPage[] {
  const unique = Array.from(new Set(pages.filter(isAppPage)));
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  return unique.filter((page) => page !== 'users' && page !== 'settings');
}

function normalizeNotificationPreferences(value: Partial<UserNotificationPreferences> | undefined): UserNotificationPreferences {
  return {
    infoEnabled: value?.infoEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.infoEnabled,
    successEnabled: value?.successEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.successEnabled,
    warningEnabled: value?.warningEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.warningEnabled,
    errorEnabled: value?.errorEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.errorEnabled,
    autoDismissMs: value?.autoDismissMs ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.autoDismissMs,
  };
}

export function readStoredUsers(): AppUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return defaultUsers;

  try {
    const parsed = JSON.parse(raw) as AppUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultUsers;
    return parsed.map((user) => ({
      ...user,
      role: user.role === 'admin' ? 'admin' : 'user',
      allowedPages: normalizePages(user.allowedPages || [], user.role === 'admin' ? 'admin' : 'user'),
      notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    }));
  } catch {
    return defaultUsers;
  }
}

export function readStoredTokens(): PasswordResetToken[] {
  const raw = localStorage.getItem(RESET_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as PasswordResetToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Number.isFinite(entry.expiresAt));
  } catch {
    return [];
  }
}

export function readStoredEmailChangeTokens(): EmailChangeToken[] {
  const raw = localStorage.getItem(EMAIL_CHANGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as EmailChangeToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Number.isFinite(entry.expiresAt) && typeof entry.nextEmail === 'string');
  } catch {
    return [];
  }
}

export function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function openResetEmailDraft(email: string, link: string): void {
  const subject = encodeURIComponent('Password reset request');
  const body = encodeURIComponent(
    [
      'A password reset was requested for your account.',
      '',
      `Use this link to reset your password: ${link}`,
      '',
      'If you did not request this reset, please ignore this email.',
    ].join('\n'),
  );

  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
}

export function openEmailChangeDraft(email: string, link: string): void {
  const subject = encodeURIComponent('Confirm your email change');
  const body = encodeURIComponent(
    [
      'An email change was requested for your account.',
      '',
      `Use this link to confirm your new email address: ${link}`,
      '',
      'If you did not request this change, you can ignore this email.',
    ].join('\n'),
  );

  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
}
