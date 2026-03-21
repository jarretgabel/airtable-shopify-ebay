import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AppPage } from '@/auth/pages';
import {
  normalizePages,
  openResetEmailDraft,
  readStoredTokens,
  readStoredUsers,
  SESSION_KEY,
} from './authStorage';
import type { AppUser, CreateUserInput, PasswordResetToken, UserRole } from './authTypes';
import type { AuthContextValue } from './authContextTypes';
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
  updateUserPassword,
} from './authContextHelpers';
import { useAuthPersistence } from './useAuthPersistence';

export type { AppUser } from './authTypes';
export type { AuthContextValue } from './authContextTypes';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => readStoredUsers());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [resetTokens, setResetTokens] = useState<PasswordResetToken[]>(() => readStoredTokens());

  useAuthPersistence({ users, currentUserId, resetTokens, setResetTokens });

  const currentUser = useMemo(
    () => getCurrentUser(users, currentUserId),
    [users, currentUserId],
  );

  const login = useCallback((email: string, password: string) => {
    const { result, userId } = attemptLogin(users, email, password);
    if (userId) {
      setCurrentUserId(userId);
    }
    return result;
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const canAccessPage = useCallback((page: AppPage) => {
    return canUserAccessPage(currentUser, page);
  }, [currentUser]);

  const accessiblePages = useMemo(() => {
    return getAccessiblePages(currentUser);
  }, [currentUser]);

  const requestPasswordReset = useCallback((email: string) => {
    const user = findUserByNormalizedEmail(users, normalizeEmail(email));
    if (!user) {
      return {
        sent: true,
        message: 'If the account exists, a reset email was sent.',
      };
    }

    const tokenEntry = buildResetTokenEntry(user.id);
    const link = buildResetLink(tokenEntry.token);

    setResetTokens((previous) => [
      ...previous.filter((item) => item.userId !== user.id),
      tokenEntry,
    ]);

    openResetEmailDraft(user.email, link);

    return {
      sent: true,
      message: `A password reset email was prepared for ${user.email}.`,
      resetLink: link,
    };
  }, [users]);

  const resetPassword = useCallback((token: string, password: string) => {
    const activeToken = resetTokens.find((entry) => entry.token === token);
    if (!activeToken || activeToken.expiresAt <= Date.now()) {
      return { success: false, message: 'This reset link is invalid or expired.' };
    }

    const { updatedUsers, updated } = updateUserPassword(users, activeToken.userId, password);
    if (updated) {
      setUsers(updatedUsers);
    }

    if (!updated) {
      return { success: false, message: 'Could not find user for this reset link.' };
    }

    setResetTokens((previous) => previous.filter((entry) => entry.token !== token));
    return { success: true, message: 'Password reset successfully. You can now log in.' };
  }, [resetTokens, users]);

  const updateUserPermissions = useCallback((userId: string, pages: AppPage[]) => {
    setUsers((previous) => previous.map((user) => {
      if (user.id !== userId) return user;
      return { ...user, allowedPages: normalizePages(pages, user.role) };
    }));
  }, []);

  const updateUserRole = useCallback((userId: string, role: UserRole) => {
    setUsers((previous) => previous.map((user) => {
      if (user.id !== userId) return user;
      return {
        ...user,
        role,
        allowedPages: normalizePages(user.allowedPages, role),
      };
    }));
  }, []);

  const createUser = useCallback((input: CreateUserInput) => {
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

    setUsers((previous) => [...previous, newUser]);
    return { success: true, message: `User ${newUser.email} created.` };
  }, [users]);

  const value = useMemo<AuthContextValue>(() => ({
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
