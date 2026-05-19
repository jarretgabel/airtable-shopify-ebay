import { type AppPage } from '@/auth/pages';
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
      allowedPages: getRoleDefaultPages('admin'),
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '1-owner',
      name: 'Owner User',
      email: 'owner@example.com',
      role: 'owner',
      allowedPages: getRoleDefaultPages('owner'),
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
    {
      id: '4',
      name: 'Dev User',
      email: 'developer@example.com',
      role: 'developer',
      allowedPages: getRoleDefaultPages('developer'),
      notificationPreferences: { ...DEFAULT_USER_NOTIFICATION_PREFERENCES },
    },
    {
      id: '5',
      name: 'Photographer User',
      email: 'photographer@example.com',
      role: 'photographer',
      allowedPages: getRoleDefaultPages('photographer'),
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
    const developer = baseUsers[4];
    const photographer = baseUsers[5];

    expect(canUserAccessPage(admin, 'users')).toBe(true);
    expect(canUserAccessPage(admin, 'market')).toBe(false);
    expect(canUserAccessPage(admin, 'imagelab')).toBe(true);
    expect(canUserAccessPage(owner, 'users')).toBe(true);
    expect(canUserAccessPage(owner, 'market')).toBe(true);
    expect(canUserAccessPage(user, 'dashboard')).toBe(true);
    expect(canUserAccessPage(user, 'workflow-guide')).toBe(true);
    expect(canUserAccessPage(user, 'manual-intake')).toBe(true);
    expect(canUserAccessPage(user, 'testing-queue')).toBe(true);
    expect(canUserAccessPage(user, 'photography-queue')).toBe(true);
    expect(canUserAccessPage(user, 'testing')).toBe(true);
    expect(canUserAccessPage(user, 'photos')).toBe(true);
    expect(canUserAccessPage(user, 'post-publish')).toBe(true);
    expect(canUserAccessPage(user, 'notifications')).toBe(true);
    expect(canUserAccessPage(user, 'market')).toBe(true);
    expect(canUserAccessPage(user, 'imagelab')).toBe(true);
    expect(canUserAccessPage(tester, 'testing')).toBe(true);
    expect(canUserAccessPage(tester, 'photos')).toBe(false);
    expect(canUserAccessPage(tester, 'imagelab')).toBe(false);
    expect(canUserAccessPage(developer, 'settings')).toBe(true);
    expect(canUserAccessPage(developer, 'notifications')).toBe(true);
    expect(canUserAccessPage(developer, 'dashboard')).toBe(true);
    expect(canUserAccessPage(developer, 'workflow-guide')).toBe(true);
    expect(canUserAccessPage(developer, 'jotform')).toBe(true);
    expect(canUserAccessPage(developer, 'market')).toBe(true);
    expect(canUserAccessPage(developer, 'imagelab')).toBe(true);
    expect(canUserAccessPage(developer, 'users')).toBe(true);
    expect(canUserAccessPage(developer, 'shopify')).toBe(true);
    expect(canUserAccessPage(developer, 'ebay')).toBe(true);
    expect(canUserAccessPage(photographer, 'imagelab')).toBe(true);
    expect(canUserAccessPage(photographer, 'market')).toBe(false);
  });

  it('filters users page for non-admin accessible pages', () => {
    const owner = baseUsers[1];
    expect(getAccessiblePages(baseUsers[2])).toEqual([
      'dashboard',
      'workflow-guide',
      'manual-intake',
      'parking-lot-1',
      'parking-lot-2',
      'trash-review',
      'inventory',
      'testing-queue',
      'photography-queue',
      'testing',
      'photos',
      'post-publish',
      'archive',
      'market',
      'imagelab',
      'settings',
      'notifications',
    ]);
    expect(getAccessiblePages(baseUsers[0])).toEqual(getRoleDefaultPages('admin'));
    expect(getAccessiblePages(owner)).toEqual(getRoleDefaultPages('owner'));
    expect(getAccessiblePages(baseUsers[3])).toEqual(['dashboard', 'workflow-guide', 'testing-queue', 'testing', 'settings', 'notifications']);
    expect(getAccessiblePages(baseUsers[4])).toEqual(getRoleDefaultPages('developer'));
    expect(getAccessiblePages(baseUsers[5])).toEqual(['dashboard', 'workflow-guide', 'photography-queue', 'photos', 'imagelab', 'settings', 'notifications']);
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

  it('ignores custom page selections and applies the chosen role bundle when building new users', () => {
    const result = buildUserFromInput({
      name: 'Hybrid Attempt',
      email: 'hybrid@example.com',
      password: 'temporary-password',
      role: 'tester',
      allowedPages: ['dashboard', 'testing', 'photos'],
    });

    expect(result.user?.allowedPages).toEqual(getRoleDefaultPages('tester'));
  });

  it('adds the workflow guide for existing users whose stored role bundle predates the page', () => {
    const legacyTester = {
      ...baseUsers[3],
      allowedPages: ['dashboard', 'testing-queue', 'testing'] as AppPage[],
    };

    expect(getAccessiblePages(legacyTester)).toEqual([
      'dashboard',
      'workflow-guide',
      'testing-queue',
      'testing',
      'settings',
      'notifications',
    ]);
  });
});
