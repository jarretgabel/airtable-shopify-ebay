import { create } from 'zustand';
import { AppPage } from '@/auth/pages';
import {
  createUserInAirtable,
  deleteUserInAirtable,
  normalizePages,
  openEmailChangeDraft,
  openResetEmailDraft,
  sendWelcomeEmail,
  EMAIL_CHANGE_KEY,
  loadUsersFromAirtable,
  RESET_KEY,
  readStoredEmailChangeTokens,
  readStoredTokens,
  readStoredUsers,
  randomToken,
  SESSION_KEY,
  updateUserInAirtable,
} from './authStorage';
import type { AppUser, CreateUserInput, EmailChangeToken, PasswordResetToken, UserRole } from './authTypes';
import type {
  AccountUpdateResult,
  CreateUserResult,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from './authContextTypes';
import {
  attemptLogin,
  buildResetLink,
  buildResetTokenEntry,
  buildUserFromInput,
  canUserAccessPage,
  findUserByNormalizedEmail,
  getCurrentUser,
  normalizeEmail,
  pruneExpiredTokens,
  updateUserPassword,
} from './authContextHelpers';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type UserNotificationPreferences } from './authTypes';
import { validatePasswordPolicy } from './passwordPolicy';

function persistSession(currentUserId: string | null): void {
  if (currentUserId) {
    localStorage.setItem(SESSION_KEY, currentUserId);
    return;
  }

  localStorage.removeItem(SESSION_KEY);
}

function persistResetTokens(resetTokens: PasswordResetToken[]): void {
  localStorage.setItem(RESET_KEY, JSON.stringify(resetTokens));
}

function persistEmailChangeTokens(emailChangeTokens: EmailChangeToken[]): void {
  localStorage.setItem(EMAIL_CHANGE_KEY, JSON.stringify(emailChangeTokens));
}

const initialResetTokens = pruneExpiredTokens(readStoredTokens());
persistResetTokens(initialResetTokens);
const initialEmailChangeTokens = pruneExpiredTokens(readStoredEmailChangeTokens());
persistEmailChangeTokens(initialEmailChangeTokens);

export interface AuthStoreState {
  users: AppUser[];
  usersLoading: boolean;
  usersReady: boolean;
  currentUserId: string | null;
  requiresPasswordChange: boolean;
  resetTokens: PasswordResetToken[];
  emailChangeTokens: EmailChangeToken[];
  initializeUsers: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => PasswordResetRequestResult;
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
  users: readStoredUsers(),
  usersLoading: false,
  usersReady: false,
  currentUserId: localStorage.getItem(SESSION_KEY),
  requiresPasswordChange: false,
  resetTokens: initialResetTokens,
  emailChangeTokens: initialEmailChangeTokens,
  initializeUsers: async () => {
    const { usersLoading, usersReady, currentUserId } = get();
    if (usersLoading || usersReady) return;

    set({ usersLoading: true });
    try {
      const users = await loadUsersFromAirtable();
      const sessionUser = currentUserId ? users.find((user) => user.id === currentUserId) ?? null : null;
      set({
        users,
        usersReady: true,
        requiresPasswordChange: Boolean(sessionUser?.mustChangePassword),
      });
    } catch (error) {
      console.error('Failed to load users from Airtable:', error);
      set({ usersReady: true });
    } finally {
      set({ usersLoading: false });
    }
  },
  login: async (email, password) => {
    const currentUsers = get().users;
    let latestUsers = currentUsers;

    try {
      latestUsers = await loadUsersFromAirtable();
      set({ users: latestUsers, usersReady: true });
    } catch (error) {
      console.error('Failed to refresh users during login:', error);
    }

    const { result, userId } = attemptLogin(latestUsers, email, password);
    if (userId) {
      const matchedUser = latestUsers.find((user) => user.id === userId) ?? null;
      set({ currentUserId: userId });
      set({ requiresPasswordChange: Boolean(matchedUser?.mustChangePassword) });
      persistSession(userId);
    }

    return result;
  },
  logout: () => {
    set({ currentUserId: null, requiresPasswordChange: false });
    persistSession(null);
  },
  canAccessPage: (page) => {
    const { users, currentUserId } = get();
    const currentUser = getCurrentUser(users, currentUserId);
    return canUserAccessPage(currentUser, page);
  },
  requestPasswordReset: (email) => {
    const { users, resetTokens } = get();
    const user = findUserByNormalizedEmail(users, normalizeEmail(email));
    if (!user) {
      return {
        sent: true,
        message: 'If the account exists, a reset email was sent.',
      };
    }

    const tokenEntry = buildResetTokenEntry(user.id);
    const link = buildResetLink(tokenEntry.token);
    const nextResetTokens = [
      ...resetTokens.filter((item) => item.userId !== user.id),
      tokenEntry,
    ];

    set({ resetTokens: nextResetTokens });
    persistResetTokens(nextResetTokens);
    openResetEmailDraft(user.email, link);

    return {
      sent: true,
      message: `A password reset email was prepared for ${user.email}.`,
      resetLink: link,
    };
  },
  resetPassword: async (token, password) => {
    const { users, resetTokens } = get();
    const activeToken = resetTokens.find((entry) => entry.token === token);
    if (!activeToken || activeToken.expiresAt <= Date.now()) {
      return { success: false, message: 'This reset link is invalid or expired.' };
    }

    const { updatedUsers, updated } = updateUserPassword(users, activeToken.userId, password);
    if (!updated) {
      return { success: false, message: 'Could not find user for this reset link.' };
    }

    const updatedUser = updatedUsers.find((user) => user.id === activeToken.userId);
    if (!updatedUser) {
      return { success: false, message: 'Could not find user for this reset link.' };
    }

    try {
      const savedUser = await updateUserInAirtable(updatedUser);
      const persistedUsers = updatedUsers.map((user) => (user.id === savedUser.id ? savedUser : user));
      const nextResetTokens = resetTokens.filter((entry) => entry.token !== token);
      set({ users: persistedUsers, resetTokens: nextResetTokens });
      persistResetTokens(nextResetTokens);
      return { success: true, message: 'Password reset successfully. You can now log in.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password in Airtable.',
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
    const { users, currentUserId, resetTokens, emailChangeTokens } = get();
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
      const nextResetTokens = resetTokens.filter((token) => token.userId !== targetUser.id);
      const nextEmailChangeTokens = emailChangeTokens.filter((token) => token.userId !== targetUser.id);
      set({
        users: updatedUsers,
        resetTokens: nextResetTokens,
        emailChangeTokens: nextEmailChangeTokens,
      });
      persistResetTokens(nextResetTokens);
      persistEmailChangeTokens(nextEmailChangeTokens);
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

    const { users, currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Email changes are disabled for the main admin account.' };
    }

    if (currentUser.password !== currentPassword) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    const duplicate = users.some((user) => user.id !== currentUserId && user.email.toLowerCase() === normalizedEmail);
    if (duplicate) {
      return { success: false, message: 'Another user already uses that email.' };
    }

    const { emailChangeTokens } = get();
    const tokenEntry: EmailChangeToken = {
      token: randomToken(),
      userId: currentUserId,
      nextEmail: normalizedEmail,
      expiresAt: Date.now() + 1000 * 60 * 60,
    };
    const nextEmailChangeTokens = [
      ...emailChangeTokens.filter((entry) => entry.userId !== currentUserId),
      tokenEntry,
    ];

    set({ emailChangeTokens: nextEmailChangeTokens });
    persistEmailChangeTokens(nextEmailChangeTokens);

    const link = `${window.location.origin}/account/settings?emailChangeToken=${encodeURIComponent(tokenEntry.token)}`;
    openEmailChangeDraft(normalizedEmail, link);

    return { success: true, message: `Confirmation email draft prepared for ${normalizedEmail}. Open the link to complete the update.` };
  },
  confirmEmailChange: async (token) => {
    const { users, emailChangeTokens } = get();
    const activeToken = emailChangeTokens.find((entry) => entry.token === token);
    if (!activeToken || activeToken.expiresAt <= Date.now()) {
      return { success: false, message: 'This email confirmation link is invalid or expired.' };
    }

    const duplicate = users.some((user) => user.id !== activeToken.userId && user.email.toLowerCase() === activeToken.nextEmail);
    if (duplicate) {
      return { success: false, message: 'Another user already uses this email address.' };
    }

    const currentUser = users.find((user) => user.id === activeToken.userId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    const updatedUser = {
      ...currentUser,
      email: activeToken.nextEmail,
    };

    try {
      const savedUser = await updateUserInAirtable(updatedUser);
      const updatedUsers = users.map((user) => (user.id === activeToken.userId ? savedUser : user));
      const nextEmailChangeTokens = emailChangeTokens.filter((entry) => entry.token !== token);
      set({ users: updatedUsers, emailChangeTokens: nextEmailChangeTokens });
      persistEmailChangeTokens(nextEmailChangeTokens);
      return { success: true, message: 'Email updated successfully.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update email in Airtable.',
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

    const { users, currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Password changes are disabled for the main admin account.' };
    }

    if (currentUser.password !== currentPassword) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    if (currentPassword === trimmedNextPassword) {
      return { success: false, message: 'New password must be different from your current password.' };
    }

    const { updatedUsers } = updateUserPassword(users, currentUserId, trimmedNextPassword);
    const nextUser = updatedUsers.find((user) => user.id === currentUserId);
    if (!nextUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const persistedUsers = updatedUsers.map((user) => (user.id === savedUser.id ? savedUser : user));
      set({ users: persistedUsers });
      set({ requiresPasswordChange: false });
      return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password in Airtable.',
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

    const { users, currentUserId, requiresPasswordChange } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (!requiresPasswordChange && !currentUser.mustChangePassword) {
      return { success: false, message: 'Password update is not required for this account.' };
    }

    if (currentUser.password === trimmedNextPassword) {
      return { success: false, message: 'New password must be different from your current password.' };
    }

    const { updatedUsers } = updateUserPassword(users, currentUserId, trimmedNextPassword);
    const nextUser = updatedUsers.find((user) => user.id === currentUserId);
    if (!nextUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const persistedUsers = updatedUsers.map((user) => (user.id === savedUser.id ? savedUser : user));
      set({ users: persistedUsers, requiresPasswordChange: false });
      return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password in Airtable.',
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
