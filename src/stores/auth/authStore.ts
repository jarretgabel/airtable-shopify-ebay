import { create } from 'zustand';
import { AppPage } from '@/auth/pages';
import {
  confirmEmailChange as confirmEmailChangeViaApi,
  login as loginViaApi,
  logout as logoutViaApi,
  requestEmailChange as requestEmailChangeViaApi,
  requestPasswordReset as requestPasswordResetViaApi,
  resetPassword as resetPasswordViaApi,
  resolveSession as resolveSessionViaApi,
  updatePassword as updatePasswordViaApi,
} from '@/services/app-api/auth';
import {
  createUserInAirtable,
  deleteUserInAirtable,
  normalizePages,
  sendWelcomeEmail,
  loadUsersFromAirtable,
  updateUserInAirtable,
} from './authStorage';
import type { AppUser, CreateUserInput, UserRole } from './authTypes';
import type {
  AccountUpdateResult,
  CreateUserResult,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from './authContextTypes';
import {
  buildUserFromInput,
  canUserAccessPage,
  getCurrentUser,
  normalizeEmail,
} from './authContextHelpers';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type UserNotificationPreferences } from './authTypes';
import { validatePasswordPolicy } from './passwordPolicy';

export interface AuthStoreState {
  users: AppUser[];
  usersLoading: boolean;
  usersReady: boolean;
  currentUserId: string | null;
  hasAuthenticatedSession: boolean;
  requiresPasswordChange: boolean;
  initializeUsers: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  resetPassword: (token: string, password: string) => Promise<PasswordResetResult>;
  updateUserPermissions: (userId: string, pages: AppPage[]) => Promise<AccountUpdateResult>;
  updateUserRole: (userId: string, role: UserRole) => Promise<AccountUpdateResult>;
  deleteUser: (userId: string) => Promise<AccountUpdateResult>;
  createUser: (input: CreateUserInput) => Promise<CreateUserResult>;
  updateCurrentUserEmail: (email: string, currentPassword: string) => Promise<AccountUpdateResult>;
  confirmEmailChange: (token: string) => Promise<AccountUpdateResult>;
  updateCurrentUserPassword: (currentPassword: string, nextPassword: string) => Promise<AccountUpdateResult>;
  completeRequiredPasswordChange: (nextPassword: string) => Promise<AccountUpdateResult>;
  updateCurrentUserNotificationPreference: <K extends keyof UserNotificationPreferences>(key: K, value: UserNotificationPreferences[K]) => Promise<AccountUpdateResult>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: [],
  usersLoading: false,
  usersReady: false,
  currentUserId: null,
  hasAuthenticatedSession: false,
  requiresPasswordChange: false,
  initializeUsers: async () => {
    const { usersLoading, usersReady } = get();
    if (usersLoading || usersReady) return;

    set({ usersLoading: true });
    try {
      const users = await loadUsersFromAirtable();
      let resolvedUserId: string | null = null;
      let requiresPasswordChange = false;

      try {
        const session = await resolveSessionViaApi();
        resolvedUserId = session.userId;
        requiresPasswordChange = session.mustChangePassword;
      } catch {
        resolvedUserId = null;
      }

      const sessionUser = resolvedUserId ? users.find((user) => user.id === resolvedUserId) ?? null : null;
      set({
        users,
        usersReady: true,
        currentUserId: sessionUser?.id ?? null,
        hasAuthenticatedSession: Boolean(sessionUser),
        requiresPasswordChange: requiresPasswordChange || Boolean(sessionUser?.mustChangePassword),
      });
    } catch (error) {
      console.error('Failed to load users from Airtable:', error);
      set({ usersReady: true });
    } finally {
      set({ usersLoading: false });
    }
  },
  login: async (email, password) => {
    try {
      const auth = await loginViaApi(email, password);
      const latestUsers = await loadUsersFromAirtable();
      set({
        users: latestUsers,
        usersReady: true,
        currentUserId: auth.userId,
        hasAuthenticatedSession: true,
        requiresPasswordChange: auth.mustChangePassword,
      });
      return { success: true, message: 'Login successful.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed.',
      };
    }
  },
  logout: () => {
    void logoutViaApi().catch(() => undefined);
    set({ currentUserId: null, hasAuthenticatedSession: false, requiresPasswordChange: false });
  },
  canAccessPage: (page) => {
    const { users, currentUserId } = get();
    const currentUser = getCurrentUser(users, currentUserId);
    return canUserAccessPage(currentUser, page);
  },
  requestPasswordReset: async (email) => {
    try {
      return await requestPasswordResetViaApi(email, window.location.origin);
    } catch (error) {
      return {
        sent: true,
        message: error instanceof Error ? error.message : 'If the account exists, a reset email was sent.',
      };
    }
  },
  resetPassword: async (token, password) => {
    try {
      const result = await resetPasswordViaApi(token, password);
      const users = await loadUsersFromAirtable();
      set({ users, requiresPasswordChange: false });
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reset password.',
      };
    }
  },
  updateUserPermissions: async (userId, pages) => {
    const { users } = get();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    const nextUser = {
      ...targetUser,
      allowedPages: normalizePages(pages, targetUser.role),
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === userId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Permissions updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update permissions in Airtable.',
      };
    }
  },
  updateUserRole: async (userId, role) => {
    const { users } = get();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    const nextUser = {
      ...targetUser,
      role,
      allowedPages: normalizePages(targetUser.allowedPages, role),
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === userId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Role updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role in Airtable.',
      };
    }
  },
  deleteUser: async (userId) => {
    const { users, currentUserId } = get();
    const currentUser = getCurrentUser(users, currentUserId);
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, message: 'Only admins can delete users.' };
    }

    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === currentUser.id) {
      return { success: false, message: 'You cannot delete your own account.' };
    }

    if (targetUser.id === 'u-admin') {
      return { success: false, message: 'The main admin account cannot be deleted.' };
    }

    if (targetUser.role === 'admin') {
      const remainingAdmins = users.filter((user) => user.role === 'admin' && user.id !== targetUser.id).length;
      if (remainingAdmins === 0) {
        return { success: false, message: 'Cannot delete the last admin account.' };
      }
    }

    try {
      await deleteUserInAirtable(targetUser);
      const updatedUsers = users.filter((user) => user.id !== targetUser.id);
      set({ users: updatedUsers });
      return { success: true, message: `Deleted user ${targetUser.email}.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user from Airtable.',
      };
    }
  },
  createUser: async (input) => {
    const { users } = get();
    const candidate = buildUserFromInput(input);
    if (candidate.result) {
      return candidate.result;
    }

    const newUser = candidate.user;
    if (!newUser) {
      return { success: false, message: 'Could not create user.' };
    }

    if (users.some((user) => user.email.toLowerCase() === newUser.email)) {
      return { success: false, message: 'A user with that email already exists.' };
    }

    try {
      const createdUser = await createUserInAirtable(newUser);
      set({ users: [...users, createdUser] });
      const delivery = await sendWelcomeEmail(createdUser.email, createdUser.password);
      const deliveryNote = delivery === 'gmail' ? 'Welcome email sent.' : 'Welcome email draft opened.';
      return { success: true, message: `User ${createdUser.email} created. ${deliveryNote}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user in Airtable.',
      };
    }
  },
  updateCurrentUserEmail: async (email, currentPassword) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return { success: false, message: 'Email is required.' };
    }

    const { users, currentUserId, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Email changes are disabled for the main admin account.' };
    }

    try {
      const result = await requestEmailChangeViaApi(normalizedEmail, currentPassword, window.location.origin);
      return {
        success: result.success,
        message: result.confirmationLink
          ? `${result.message} Development confirmation link: ${result.confirmationLink}`
          : result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to request email change.',
      };
    }
  },
  confirmEmailChange: async (token) => {
    try {
      const result = await confirmEmailChangeViaApi(token);
      const users = await loadUsersFromAirtable();
      set({ users });
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update email.',
      };
    }
  },
  updateCurrentUserPassword: async (currentPassword, nextPassword) => {
    const trimmedNextPassword = nextPassword.trim();
    if (!trimmedNextPassword) {
      return { success: false, message: 'New password is required.' };
    }

    const passwordPolicyError = validatePasswordPolicy(trimmedNextPassword);
    if (passwordPolicyError) {
      return { success: false, message: passwordPolicyError };
    }

    const { users, currentUserId, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Password changes are disabled for the main admin account.' };
    }

    try {
      const result = await updatePasswordViaApi(trimmedNextPassword, currentPassword);
      const refreshedUsers = await loadUsersFromAirtable();
      set({ users: refreshedUsers, hasAuthenticatedSession: true, requiresPasswordChange: Boolean(result.mustChangePassword) });
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password.',
      };
    }
  },
  completeRequiredPasswordChange: async (nextPassword) => {
    const trimmedNextPassword = nextPassword.trim();
    if (!trimmedNextPassword) {
      return { success: false, message: 'New password is required.' };
    }

    const passwordPolicyError = validatePasswordPolicy(trimmedNextPassword);
    if (passwordPolicyError) {
      return { success: false, message: passwordPolicyError };
    }

    const { users, currentUserId, requiresPasswordChange, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (!requiresPasswordChange && !currentUser.mustChangePassword) {
      return { success: false, message: 'Password update is not required for this account.' };
    }

    try {
      const result = await updatePasswordViaApi(trimmedNextPassword);
      const refreshedUsers = await loadUsersFromAirtable();
      set({ users: refreshedUsers, hasAuthenticatedSession: true, requiresPasswordChange: Boolean(result.mustChangePassword) });
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password.',
      };
    }
  },
  updateCurrentUserNotificationPreference: async (key, value) => {
    const { users, currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    const currentPreferences = currentUser.notificationPreferences ?? { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
    const nextUser = {
      ...currentUser,
      notificationPreferences: {
        ...currentPreferences,
        [key]: value,
      },
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === currentUserId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Notification preference updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update notifications in Airtable.',
      };
    }
  },
}));
