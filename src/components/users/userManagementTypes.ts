import { AppPage } from '@/auth/pages';
import type { AssignableUserRole, UserRole } from '@/stores/auth/authTypes';

export type RoleFilter = 'all' | UserRole;
export type UserSortKey = 'name' | 'email' | 'role' | 'pages';

export interface NewUserFormState {
  name: string;
  email: string;
  password: string;
  role: AssignableUserRole;
  allowedPages: AppPage[];
}