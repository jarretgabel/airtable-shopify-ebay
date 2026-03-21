import { AppPage } from '@/auth/pages';
import type { AppUser, CreateUserInput, UserRole } from './authTypes';

export interface LoginResult {
  success: boolean;
  message: string;
}

export interface PasswordResetRequestResult {
  sent: boolean;
  message: string;
  resetLink?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
}

export interface CreateUserResult {
  success: boolean;
  message: string;
}

export interface AuthContextValue {
  currentUser: AppUser | null;
  users: AppUser[];
  isAdmin: boolean;
  accessiblePages: AppPage[];
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => PasswordResetRequestResult;
  resetPassword: (token: string, password: string) => PasswordResetResult;
  updateUserPermissions: (userId: string, pages: AppPage[]) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  createUser: (input: CreateUserInput) => CreateUserResult;
}
