import { type AppPage } from '@/auth/pages';
import { getRoleDefaultPages, normalizeRolePages } from '@/auth/roleAccess';
import { createNotificationPreferencesForRole } from '@/services/roleNotificationDefaults';
import { normalizePages, randomToken } from './authStorage';
import { type AppUser, type CreateUserInput, type UserRole } from './authTypes';
import type { CreateUserResult } from './authContextTypes';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function getCurrentUser(users: AppUser[], currentUserId: string | null): AppUser | null {
  return users.find((user) => user.id === currentUserId) ?? null;
}

export function canUserAccessPage(currentUser: AppUser | null, page: AppPage): boolean {
  if (!currentUser) return false;
  if (page === 'settings' || page === 'notifications') return true;
  return normalizeRolePages(currentUser.allowedPages, currentUser.role).includes(page);
}

export function getAccessiblePages(currentUser: AppUser | null): AppPage[] {
  if (!currentUser) return [];
  return Array.from(new Set([...normalizeRolePages(currentUser.allowedPages, currentUser.role), 'settings', 'notifications']));
}

export function buildUserFromInput(input: CreateUserInput): { result?: CreateUserResult; user?: AppUser } {
  const email = normalizeEmail(input.email);
  if (!email || !input.name.trim() || !input.password.trim()) {
    return { result: { success: false, message: 'Name, email, and password are required.' } };
  }

  const role: UserRole = input.role;
  const allowedPages = normalizePages(getRoleDefaultPages(role), role);

  return {
    user: {
      id: randomToken(),
      name: input.name.trim(),
      email,
      role,
      password: input.password,
      mustChangePassword: true,
      allowedPages,
      notificationPreferences: createNotificationPreferencesForRole(role),
    },
  };
}
