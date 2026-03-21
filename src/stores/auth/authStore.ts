import { useMemo, type ReactNode } from 'react';
import { create } from 'zustand';
import { AppPage } from '@/auth/pages';
import {
  normalizePages,
  openResetEmailDraft,
  RESET_KEY,
  readStoredTokens,
  readStoredUsers,
  SESSION_KEY,
  USERS_KEY,
} from './authStorage';
import type { AppUser, CreateUserInput, PasswordResetToken, UserRole } from './authTypes';
import type {
  AuthContextValue,
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
  getAccessiblePages,
  getCurrentUser,
  normalizeEmail,
  pruneExpiredTokens,
  updateUserPassword,
} from './authContextHelpers';

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

const initialResetTokens = pruneExpiredTokens(readStoredTokens());
persistResetTokens(initialResetTokens);

interface AuthStoreState {
  users: AppUser[];
  currentUserId: string | null;
  resetTokens: PasswordResetToken[];
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => PasswordResetRequestResult;
  resetPassword: (token: string, password: string) => PasswordResetResult;
  updateUserPermissions: (userId: string, pages: AppPage[]) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  createUser: (input: CreateUserInput) => CreateUserResult;
}

const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: readStoredUsers(),
  currentUserId: localStorage.getItem(SESSION_KEY),
  resetTokens: initialResetTokens,
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
}));

export function AuthProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useAuth(): AuthContextValue {
  const users = useAuthStore((state) => state.users);
  const currentUserId = useAuthStore((state) => state.currentUserId);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const canAccessPage = useAuthStore((state) => state.canAccessPage);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const updateUserPermissions = useAuthStore((state) => state.updateUserPermissions);
  const updateUserRole = useAuthStore((state) => state.updateUserRole);
  const createUser = useAuthStore((state) => state.createUser);

  const currentUser = getCurrentUser(users, currentUserId);
  const accessiblePages = getAccessiblePages(currentUser);

  return useMemo<AuthContextValue>(() => ({
    currentUser,
    users,
    isAdmin: currentUser?.role === 'admin',
    accessiblePages,
    login,
    logout,
    canAccessPage,
    requestPasswordReset,
    resetPassword,
    updateUserPermissions,
    updateUserRole,
    createUser,
  }), [
    currentUser,
    users,
    accessiblePages,
    login,
    logout,
    canAccessPage,
    requestPasswordReset,
    resetPassword,
    updateUserPermissions,
    updateUserRole,
    createUser,
  ]);
}
