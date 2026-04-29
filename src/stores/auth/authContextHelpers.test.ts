import { APP_PAGES } from '@/auth/pages';
import {
  canUserAccessPage,
  getAccessiblePages,
  getCurrentUser,
  normalizeEmail,
} from '@/stores/auth/authContextHelpers';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser } from '@/stores/auth/authTypes';

describe('authContextHelpers', () => {
  const baseUsers: AppUser[] = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      allowedPages: [...APP_PAGES],
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '2',
      name: 'Normal User',
      email: 'user@example.com',
      role: 'user',
      allowedPages: ['dashboard', 'inventory', 'users'],
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
  ];

  it('normalizes email addresses', () => {
    expect(normalizeEmail('  USER@Example.com ')).toBe('user@example.com');
  });

  it('returns current user from id', () => {
    expect(getCurrentUser(baseUsers, '1')?.name).toBe('Admin User');
    expect(getCurrentUser(baseUsers, 'missing')).toBeNull();
  });

  it('respects admin and page permissions', () => {
    const admin = baseUsers[0];
    const user = baseUsers[1];

    expect(canUserAccessPage(admin, 'users')).toBe(true);
    expect(canUserAccessPage(user, 'dashboard')).toBe(true);
    expect(canUserAccessPage(user, 'incoming-gear')).toBe(true);
    expect(canUserAccessPage(user, 'testing')).toBe(true);
    expect(canUserAccessPage(user, 'photos')).toBe(true);
    expect(canUserAccessPage(user, 'notifications')).toBe(true);
    expect(canUserAccessPage(user, 'market')).toBe(false);
  });

  it('filters users page for non-admin accessible pages', () => {
    const user = baseUsers[1];
    expect(getAccessiblePages(user)).toEqual(['dashboard', 'inventory', 'incoming-gear', 'testing', 'photos', 'settings', 'notifications']);
    expect(getAccessiblePages(baseUsers[0])).toEqual(APP_PAGES);
  });
});
