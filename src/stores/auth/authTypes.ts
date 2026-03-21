import { AppPage } from '@/auth/pages';

export type UserRole = 'admin' | 'user';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  allowedPages: AppPage[];
}
