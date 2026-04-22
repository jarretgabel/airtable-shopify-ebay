import { APP_PAGES } from '@/auth/pages';
import {
  attemptLogin,
  canUserAccessPage,
  findUserByNormalizedEmail,
  getAccessiblePages,
  getCurrentUser,
  normalizeEmail,
  pruneExpiredTokens,
  updateUserPassword,
} from '@/stores/auth/authContextHelpers';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser, type PasswordResetToken } from '@/stores/auth/authTypes';

describe('authContextHelpers', () => {
  const baseUsers: AppUser[] = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      password: 'admin-pass',
      allowedPages: [...APP_PAGES],
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '2',
      name: 'Normal User',
      email: 'user@example.com',
      role: 'user',
      password: 'user-pass',
      allowedPages: ['dashboard', 'airtable', 'users'],
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
  ];

  it('normalizes email addresses', () => {
    expect(normalizeEmail('  USER@Example.com ')).toBe('user@example.com');
  });

  it('finds users by normalized email', () => {
    const result = findUserByNormalizedEmail(baseUsers, 'user@example.com');
    expect(result?.id).toBe('2');
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
    expect(canUserAccessPage(user, 'request-form')).toBe(true);
    expect(canUserAccessPage(user, 'notifications')).toBe(true);
    expect(canUserAccessPage(user, 'market')).toBe(false);
  });

  it('filters users page for non-admin accessible pages', () => {
    const user = baseUsers[1];
    expect(getAccessiblePages(user)).toEqual(['dashboard', 'airtable', 'request-form', 'settings', 'notifications']);
    expect(getAccessiblePages(baseUsers[0])).toEqual(APP_PAGES);
  });

  it('returns success and failure states for login', () => {
    const ok = attemptLogin(baseUsers, ' USER@EXAMPLE.COM ', 'user-pass');
    const fail = attemptLogin(baseUsers, 'user@example.com', 'wrong');

    expect(ok.result.success).toBe(true);
    expect(ok.userId).toBe('2');
    expect(fail.result.success).toBe(false);
    expect(fail.userId).toBeNull();
  });

  it('prunes expired reset tokens', () => {
    const now = 200;
    const tokens: PasswordResetToken[] = [
      { token: 'a', userId: '1', expiresAt: 199 },
      { token: 'b', userId: '2', expiresAt: 201 },
    ];

    expect(pruneExpiredTokens(tokens, now)).toEqual([{ token: 'b', userId: '2', expiresAt: 201 }]);
  });

  it('updates matching user password only', () => {
    const { updated, updatedUsers } = updateUserPassword(baseUsers, '2', 'new-pass');
    expect(updated).toBe(true);
    expect(updatedUsers.find((u) => u.id === '2')?.password).toBe('new-pass');
    expect(updatedUsers.find((u) => u.id === '1')?.password).toBe('admin-pass');
  });
});
