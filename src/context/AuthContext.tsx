import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_PAGES, AppPage, ASSIGNABLE_PAGES } from '@/auth/pages';

type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}

interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}

interface AuthContextValue {
  currentUser: AppUser | null;
  users: AppUser[];
  isAdmin: boolean;
  accessiblePages: AppPage[];
  login: (email: string, password: string) => { success: boolean; message: string };
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => { sent: boolean; message: string; resetLink?: string };
  resetPassword: (token: string, password: string) => { success: boolean; message: string };
  updateUserPermissions: (userId: string, pages: AppPage[]) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  createUser: (input: CreateUserInput) => { success: boolean; message: string };
}

const USERS_KEY = 'listing-control-center.users';
const SESSION_KEY = 'listing-control-center.session';
const RESET_KEY = 'listing-control-center.reset-tokens';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

function normalizePages(pages: AppPage[], role: UserRole): AppPage[] {
  const unique = Array.from(new Set(pages.filter(isAppPage)));
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  return unique.filter((page) => page !== 'users');
}

function readStoredUsers(): AppUser[] {
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

function readStoredTokens(): PasswordResetToken[] {
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

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openResetEmailDraft(email: string, link: string): void {
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => readStoredUsers());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [resetTokens, setResetTokens] = useState<PasswordResetToken[]>(() => readStoredTokens());

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(SESSION_KEY, currentUserId);
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUserId]);

  useEffect(() => {
    const activeTokens = resetTokens.filter((token) => token.expiresAt > Date.now());
    localStorage.setItem(RESET_KEY, JSON.stringify(activeTokens));
    if (activeTokens.length !== resetTokens.length) {
      setResetTokens(activeTokens);
    }
  }, [resetTokens]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [users, currentUserId],
  );

  const login = useCallback((email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const found = users.find((user) => user.email.toLowerCase() === normalizedEmail);
    if (!found || found.password !== password) {
      return { success: false, message: 'Invalid email or password.' };
    }

    setCurrentUserId(found.id);
    return { success: true, message: 'Login successful.' };
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const canAccessPage = useCallback((page: AppPage) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.allowedPages.includes(page);
  }, [currentUser]);

  const accessiblePages = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return [...APP_PAGES];
    return currentUser.allowedPages.filter((page) => page !== 'users');
  }, [currentUser]);

  const requestPasswordReset = useCallback((email: string) => {
    const user = users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return {
        sent: true,
        message: 'If the account exists, a reset email was sent.',
      };
    }

    const token = randomToken();
    const expiresAt = Date.now() + 1000 * 60 * 60;
    const link = `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`;

    setResetTokens((previous) => [
      ...previous.filter((item) => item.userId !== user.id),
      { token, userId: user.id, expiresAt },
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

    let updated = false;
    setUsers((previous) => previous.map((user) => {
      if (user.id !== activeToken.userId) return user;
      updated = true;
      return { ...user, password };
    }));

    if (!updated) {
      return { success: false, message: 'Could not find user for this reset link.' };
    }

    setResetTokens((previous) => previous.filter((entry) => entry.token !== token));
    return { success: true, message: 'Password reset successfully. You can now log in.' };
  }, [resetTokens]);

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
    const email = input.email.trim().toLowerCase();
    if (!email || !input.name.trim() || !input.password.trim()) {
      return { success: false, message: 'Name, email, and password are required.' };
    }

    if (users.some((user) => user.email.toLowerCase() === email)) {
      return { success: false, message: 'A user with that email already exists.' };
    }

    const role: UserRole = input.role === 'admin' ? 'admin' : 'user';
    const newUser: AppUser = {
      id: randomToken(),
      name: input.name.trim(),
      email,
      role,
      password: input.password,
      allowedPages: normalizePages(input.allowedPages.length ? input.allowedPages : ASSIGNABLE_PAGES, role),
    };

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
