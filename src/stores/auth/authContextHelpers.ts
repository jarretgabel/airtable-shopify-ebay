import { APP_PAGES, AppPage, ASSIGNABLE_PAGES } from '@/auth/pages';
import { normalizePages, randomToken } from './authStorage';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser, type CreateUserInput, type PasswordResetToken, type UserRole } from './authTypes';
import type { CreateUserResult, LoginResult } from './authContextTypes';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function findUserByNormalizedEmail(users: AppUser[], normalizedEmail: string): AppUser | undefined {
  return users.find((user) => user.email.toLowerCase() === normalizedEmail);
}

export function getCurrentUser(users: AppUser[], currentUserId: string | null): AppUser | null {
  return users.find((user) => user.id === currentUserId) ?? null;
}

export function canUserAccessPage(currentUser: AppUser | null, page: AppPage): boolean {
  if (!currentUser) return false;
  if (page === 'settings' || page === 'notifications' || page === 'incoming-gear' || page === 'testing' || page === 'photos') return true;
  if (currentUser.role === 'admin') return true;
  return currentUser.allowedPages.includes(page);
}

export function getAccessiblePages(currentUser: AppUser | null): AppPage[] {
  if (!currentUser) return [];
  if (currentUser.role === 'admin') return [...APP_PAGES];
  return Array.from(new Set([...currentUser.allowedPages.filter((page) => page !== 'users' && page !== 'settings' && page !== 'notifications' && page !== 'incoming-gear' && page !== 'testing' && page !== 'photos'), 'incoming-gear', 'testing', 'photos', 'settings', 'notifications']));
}

export function attemptLogin(users: AppUser[], email: string, password: string): { result: LoginResult; userId: string | null } {
  const normalizedEmail = normalizeEmail(email);
  const found = findUserByNormalizedEmail(users, normalizedEmail);

  if (!found || found.password !== password) {
    return {
      result: { success: false, message: 'Invalid email or password.' },
      userId: null,
    };
  }

  return {
    result: { success: true, message: 'Login successful.' },
    userId: found.id,
  };
}

export function buildResetTokenEntry(userId: string): PasswordResetToken {
  return {
    token: randomToken(),
    userId,
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
}

export function buildResetLink(token: string): string {
  return `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`;
}

export function pruneExpiredTokens<T extends { expiresAt: number }>(tokens: T[], now = Date.now()): T[] {
  return tokens.filter((token) => token.expiresAt > now);
}

export function updateUserPassword(users: AppUser[], userId: string, password: string): { updatedUsers: AppUser[]; updated: boolean } {
  let updated = false;
  const updatedUsers = users.map((user) => {
    if (user.id !== userId) return user;
    updated = true;
    return { ...user, password, mustChangePassword: false };
  });

  return { updatedUsers, updated };
}

export function buildUserFromInput(input: CreateUserInput): { result?: CreateUserResult; user?: AppUser } {
  const email = normalizeEmail(input.email);
  if (!email || !input.name.trim() || !input.password.trim()) {
    return { result: { success: false, message: 'Name, email, and password are required.' } };
  }

  const role: UserRole = input.role === 'admin' ? 'admin' : 'user';
  const allowedPages = normalizePages(input.allowedPages.length ? input.allowedPages : ASSIGNABLE_PAGES, role);

  return {
    user: {
      id: randomToken(),
      name: input.name.trim(),
      email,
      role,
      password: input.password,
      mustChangePassword: true,
      allowedPages,
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
  };
}
