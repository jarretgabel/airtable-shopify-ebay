import { create } from 'zustand';
import { AppPage } from '@/auth/pages';
import {
  normalizePages,
  openEmailChangeDraft,
  openResetEmailDraft,
  EMAIL_CHANGE_KEY,
  RESET_KEY,
  readStoredEmailChangeTokens,
  readStoredTokens,
  readStoredUsers,
  randomToken,
  SESSION_KEY,
  USERS_KEY,
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

function persistUsers(users: AppUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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
  currentUserId: string | null;
  resetTokens: PasswordResetToken[];
  emailChangeTokens: EmailChangeToken[];
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => PasswordResetRequestResult;
  resetPassword: (token: string, password: string) => PasswordResetResult;
  updateUserPermissions: (userId: string, pages: AppPage[]) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  createUser: (input: CreateUserInput) => CreateUserResult;
  updateCurrentUserEmail: (email: string, currentPassword: string) => AccountUpdateResult;
  confirmEmailChange: (token: string) => AccountUpdateResult;
  updateCurrentUserPassword: (currentPassword: string, nextPassword: string) => AccountUpdateResult;
  updateCurrentUserNotificationPreference: <K extends keyof UserNotificationPreferences>(key: K, value: UserNotificationPreferences[K]) => AccountUpdateResult;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: readStoredUsers(),
  currentUserId: localStorage.getItem(SESSION_KEY),
  resetTokens: initialResetTokens,
  emailChangeTokens: initialEmailChangeTokens,
  login: (email, password) => {
    const { users } = get();
    const { result, userId } = attemptLogin(users, email, password);
    if (userId) {
      set({ currentUserId: userId });
      persistSession(userId);
    }

    return result;
  },
  logout: () => {
    set({ currentUserId: null });
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
  resetPassword: (token, password) => {
    const { users, resetTokens } = get();
    const activeToken = resetTokens.find((entry) => entry.token === token);
    if (!activeToken || activeToken.expiresAt <= Date.now()) {
      return { success: false, message: 'This reset link is invalid or expired.' };
    }

    const { updatedUsers, updated } = updateUserPassword(users, activeToken.userId, password);
    if (!updated) {
      return { success: false, message: 'Could not find user for this reset link.' };
    }

    const nextResetTokens = resetTokens.filter((entry) => entry.token !== token);
    set({ users: updatedUsers, resetTokens: nextResetTokens });
    persistUsers(updatedUsers);
    persistResetTokens(nextResetTokens);
    return { success: true, message: 'Password reset successfully. You can now log in.' };
  },
  updateUserPermissions: (userId, pages) => {
    const { users } = get();
    const updatedUsers = users.map((user) => {
      if (user.id !== userId) return user;
      return { ...user, allowedPages: normalizePages(pages, user.role) };
    });

    set({ users: updatedUsers });
    persistUsers(updatedUsers);
  },
  updateUserRole: (userId, role) => {
    const { users } = get();
    const updatedUsers = users.map((user) => {
      if (user.id !== userId) return user;
      return {
        ...user,
        role,
        allowedPages: normalizePages(user.allowedPages, role),
      };
    });

    set({ users: updatedUsers });
    persistUsers(updatedUsers);
  },
  createUser: (input) => {
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

    const updatedUsers = [...users, newUser];
    set({ users: updatedUsers });
    persistUsers(updatedUsers);
    return { success: true, message: `User ${newUser.email} created.` };
  },
  updateCurrentUserEmail: (email, currentPassword) => {
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

    const link = `${window.location.origin}/settings?emailChangeToken=${encodeURIComponent(tokenEntry.token)}`;
    openEmailChangeDraft(normalizedEmail, link);

    return { success: true, message: `Confirmation email draft prepared for ${normalizedEmail}. Open the link to complete the update.` };
  },
  confirmEmailChange: (token) => {
    const { users, emailChangeTokens } = get();
    const activeToken = emailChangeTokens.find((entry) => entry.token === token);
    if (!activeToken || activeToken.expiresAt <= Date.now()) {
      return { success: false, message: 'This email confirmation link is invalid or expired.' };
    }

    const duplicate = users.some((user) => user.id !== activeToken.userId && user.email.toLowerCase() === activeToken.nextEmail);
    if (duplicate) {
      return { success: false, message: 'Another user already uses this email address.' };
    }

    const updatedUsers = users.map((user) =>
      user.id === activeToken.userId
        ? { ...user, email: activeToken.nextEmail }
        : user,
    );

    const nextEmailChangeTokens = emailChangeTokens.filter((entry) => entry.token !== token);
    set({ users: updatedUsers, emailChangeTokens: nextEmailChangeTokens });
    persistUsers(updatedUsers);
    persistEmailChangeTokens(nextEmailChangeTokens);
    return { success: true, message: 'Email updated successfully.' };
  },
  updateCurrentUserPassword: (currentPassword, nextPassword) => {
    const trimmedNextPassword = nextPassword.trim();
    if (!trimmedNextPassword) {
      return { success: false, message: 'New password is required.' };
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
    set({ users: updatedUsers });
    persistUsers(updatedUsers);
    return { success: true, message: 'Password updated successfully.' };
  },
  updateCurrentUserNotificationPreference: (key, value) => {
    const { users, currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    const hasCurrentUser = users.some((user) => user.id === currentUserId);
    if (!hasCurrentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    const updatedUsers = users.map((user) => {
      if (user.id !== currentUserId) return user;

      const currentPreferences = user.notificationPreferences ?? { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
      return {
        ...user,
        notificationPreferences: {
          ...currentPreferences,
          [key]: value,
        },
      };
    });

    set({ users: updatedUsers });
    persistUsers(updatedUsers);
    return { success: true, message: 'Notification preference updated.' };
  },
}));
