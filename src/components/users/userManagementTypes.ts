import { AppPage } from '@/auth/pages';

export type RoleFilter = 'all' | 'admin' | 'user';
export type UserSortKey = 'name' | 'email' | 'role' | 'pages';

export interface NewUserFormState {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  allowedPages: AppPage[];
}