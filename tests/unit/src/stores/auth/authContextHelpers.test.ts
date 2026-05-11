import { APP_PAGES } from '@/auth/pages';
import { getRoleDefaultPages } from '@/auth/roleAccess';
import {
  createDefaultRoleWorkflowNotificationDefaults,
  setRoleWorkflowNotificationDefaults,
} from '@/services/roleNotificationDefaults';
import {
  buildUserFromInput,
  canUserAccessPage,
  getAccessiblePages,
  getCurrentUser,
  normalizeEmail,
} from '@/stores/auth/authContextHelpers';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser } from '@/stores/auth/authTypes';

describe('authContextHelpers', () => {
  beforeEach(() => {
    setRoleWorkflowNotificationDefaults(createDefaultRoleWorkflowNotificationDefaults());
  });

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
      id: '1-owner',
      name: 'Owner User',
      email: 'owner@example.com',
      role: 'owner',
      allowedPages: [...APP_PAGES],
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '2',
      name: 'Processor User',
      email: 'user@example.com',
      role: 'processor',
      allowedPages: getRoleDefaultPages('processor'),
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '3',
      name: 'Tester User',
      email: 'tester@example.com',
      role: 'tester',
      allowedPages: getRoleDefaultPages('tester'),
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
    const owner = baseUsers[1];
    const user = baseUsers[2];
    const tester = baseUsers[3];

    expect(canUserAccessPage(admin, 'users')).toBe(true);
    expect(canUserAccessPage(owner, 'users')).toBe(true);
    expect(canUserAccessPage(user, 'dashboard')).toBe(true);
    expect(canUserAccessPage(user, 'incoming-gear')).toBe(true);
    expect(canUserAccessPage(user, 'testing')).toBe(true);
    expect(canUserAccessPage(user, 'photos')).toBe(true);
    expect(canUserAccessPage(user, 'notifications')).toBe(true);
    expect(canUserAccessPage(user, 'market')).toBe(false);
    expect(canUserAccessPage(tester, 'testing')).toBe(true);
    expect(canUserAccessPage(tester, 'photos')).toBe(false);
  });

  it('filters users page for non-admin accessible pages', () => {
    const owner = baseUsers[1];
    expect(getAccessiblePages(baseUsers[2])).toEqual([
      'dashboard',
      'inventory',
      'jotform',
      'parking-lot-2',
      'trash-review',
      'testing-queue',
      'photography-queue',
      'pre-listing-queue',
      'incoming-gear',
      'testing',
      'photos',
      'settings',
      'notifications',
    ]);
    expect(getAccessiblePages(baseUsers[0])).toEqual(APP_PAGES);
    expect(getAccessiblePages(owner)).toEqual(APP_PAGES);
    expect(getAccessiblePages(baseUsers[3])).toEqual(['dashboard', 'testing-queue', 'testing', 'settings', 'notifications']);
  });

  it('uses stored role notification defaults when building new users', () => {
    setRoleWorkflowNotificationDefaults({
      ...createDefaultRoleWorkflowNotificationDefaults(),
      tester: {
        pendingReview: false,
        processing: false,
        testing: true,
        photography: false,
        preListingReview: false,
        approvedForPublish: true,
      },
    });

    const result = buildUserFromInput({
      name: 'New Tester',
      email: 'newtester@example.com',
      password: 'temporary-password',
      role: 'tester',
      allowedPages: getRoleDefaultPages('tester'),
    });

    expect(result.user?.notificationPreferences.workflowEvents).toEqual({
      pendingReview: false,
      processing: false,
      testing: true,
      photography: false,
      preListingReview: false,
      approvedForPublish: true,
    });
  });
});
