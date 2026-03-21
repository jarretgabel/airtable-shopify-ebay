import { APP_PAGES, AppPage } from '@/auth/pages';
import type { AppUser, PasswordResetToken, UserRole } from './authTypes';

export const USERS_KEY = 'listing-control-center.users';
export const SESSION_KEY = 'listing-control-center.session';
export const RESET_KEY = 'listing-control-center.reset-tokens';

const defaultUsers: AppUser[] = [
  {
    id: 'u-admin',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    password: 'Admin123!',
    allowedPages: [...APP_PAGES],
  },
  {
    id: 'u-operator',
    name: 'Operations User',
    email: 'operator@example.com',
    role: 'user',
    password: 'User123!',
    allowedPages: ['dashboard', 'airtable', 'shopify', 'jotform', 'approval'],
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

  return unique.filter((page) => page !== 'users');
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
