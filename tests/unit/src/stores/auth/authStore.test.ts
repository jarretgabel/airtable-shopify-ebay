import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppUser } from '@/stores/auth/authTypes';
import { useAuthStore } from '@/stores/auth/authStore';

const { updateUserInAirtableMock } = vi.hoisted(() => ({
  updateUserInAirtableMock: vi.fn(),
}));

vi.mock('@/stores/auth/authStorage', async () => {
  const actual = await vi.importActual<typeof import('@/stores/auth/authStorage')>('@/stores/auth/authStorage');
  return {
    ...actual,
    updateUserInAirtable: updateUserInAirtableMock,
    loadUsersFromAirtable: vi.fn(async () => []),
    createUserInAirtable: vi.fn(),
    deleteUserInAirtable: vi.fn(),
    sendWelcomeEmail: vi.fn(),
  };
});

vi.mock('@/services/app-api/auth', () => ({
  confirmEmailChange: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  requestEmailChange: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  resolveSession: vi.fn(),
  updatePassword: vi.fn(),
}));

function buildUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: 'user-1',
    name: 'Taylor Reviewer',
    email: 'taylor@example.com',
    role: 'tester',
    allowedPages: ['dashboard', 'testing-queue', 'testing'],
    notificationPreferences: {
      infoEnabled: false,
      successEnabled: true,
      warningEnabled: false,
      errorEnabled: true,
      autoDismissMs: 9000,
      workflowEvents: {
        pendingReview: true,
        processing: true,
        testing: false,
        photography: true,
        preListingReview: true,
        approvedForPublish: false,
      },
    },
    ...overrides,
  };
}

describe('authStore updateUserRole', () => {
  beforeEach(() => {
    window.localStorage.clear();
    updateUserInAirtableMock.mockReset();
    useAuthStore.setState({
      users: [],
      currentUserId: null,
      usersLoading: false,
      usersReady: true,
      hasAuthenticatedSession: false,
      requiresPasswordChange: false,
      roleNotificationDefaults: {
        admin: {
          pendingReview: true,
          processing: true,
          testing: true,
          photography: true,
          preListingReview: true,
          approvedForPublish: true,
        },
        owner: {
          pendingReview: true,
          processing: true,
          testing: true,
          photography: true,
          preListingReview: true,
          approvedForPublish: true,
        },
        processor: {
          pendingReview: true,
          processing: true,
          testing: true,
          photography: true,
          preListingReview: true,
          approvedForPublish: true,
        },
        tester: {
          pendingReview: false,
          processing: false,
          testing: true,
          photography: false,
          preListingReview: false,
          approvedForPublish: false,
        },
        photographer: {
          pendingReview: false,
          processing: false,
          testing: false,
          photography: true,
          preListingReview: false,
          approvedForPublish: false,
        },
      },
    });
  });

  it('preserves explicit user notification settings over role defaults when changing roles', async () => {
    const startingUser = buildUser();
    updateUserInAirtableMock.mockImplementation(async (user: AppUser) => user);
    useAuthStore.setState({ users: [startingUser] });

    const result = await useAuthStore.getState().updateUserRole(startingUser.id, 'photographer');

    expect(result.success).toBe(true);
    expect(updateUserInAirtableMock).toHaveBeenCalledWith(expect.objectContaining({
      role: 'photographer',
      notificationPreferences: expect.objectContaining({
        infoEnabled: false,
        successEnabled: true,
        warningEnabled: false,
        errorEnabled: true,
        autoDismissMs: 9000,
        workflowEvents: {
          pendingReview: true,
          processing: true,
          testing: false,
          photography: true,
          preListingReview: true,
          approvedForPublish: false,
        },
      }),
    }));

    expect(useAuthStore.getState().users[0]?.notificationPreferences.workflowEvents).toEqual({
      pendingReview: true,
      processing: true,
      testing: false,
      photography: true,
      preListingReview: true,
      approvedForPublish: false,
    });
  });

  it('rejects owner role changes from the app', async () => {
    const startingUser = buildUser();
    useAuthStore.setState({ users: [startingUser] });

    const result = await useAuthStore.getState().updateUserRole(startingUser.id, 'owner');

    expect(result).toEqual({
      success: false,
      message: 'Owner role changes must be made with the package script.',
    });
    expect(updateUserInAirtableMock).not.toHaveBeenCalled();
  });

  it('rejects role changes for existing owner accounts from the app', async () => {
    const ownerUser = buildUser({ role: 'owner', allowedPages: [] });
    useAuthStore.setState({ users: [ownerUser] });

    const result = await useAuthStore.getState().updateUserRole(ownerUser.id, 'admin');

    expect(result).toEqual({
      success: false,
      message: 'Owner role changes must be made with the package script.',
    });
    expect(updateUserInAirtableMock).not.toHaveBeenCalled();
  });

  it('rejects owner account creation from the app', async () => {
    const result = await useAuthStore.getState().createUser({
      name: 'Olivia Owner',
      email: 'owner@example.com',
      role: 'owner' as never,
      password: 'Owner123!',
      allowedPages: [],
    });

    expect(result).toEqual({
      success: false,
      message: 'Owner accounts must be created with the package script.',
    });
  });

  it('rejects owner permission changes from User Management', async () => {
    const ownerUser = buildUser({ role: 'owner', allowedPages: [] });
    useAuthStore.setState({ users: [ownerUser] });

    const result = await useAuthStore.getState().updateUserPermissions(ownerUser.id, ['dashboard']);

    expect(result).toEqual({
      success: false,
      message: 'Owner account access is managed outside User Management.',
    });
    expect(updateUserInAirtableMock).not.toHaveBeenCalled();
  });

  it('rejects deleting owner accounts from the app', async () => {
    const actingAdmin = buildUser({ id: 'admin-1', role: 'admin', email: 'admin@example.com', allowedPages: [] });
    const ownerUser = buildUser({ id: 'owner-1', role: 'owner', email: 'owner@example.com', allowedPages: [] });
    useAuthStore.setState({ users: [actingAdmin, ownerUser], currentUserId: actingAdmin.id });

    const result = await useAuthStore.getState().deleteUser(ownerUser.id);

    expect(result).toEqual({
      success: false,
      message: 'Owner accounts cannot be deleted from the app.',
    });
  });

  it('rejects editing owner workflow alerts from another account', async () => {
    const actingAdmin = buildUser({ id: 'admin-1', role: 'admin', email: 'admin@example.com', allowedPages: [] });
    const ownerUser = buildUser({ id: 'owner-1', role: 'owner', email: 'owner@example.com', allowedPages: [] });
    useAuthStore.setState({ users: [actingAdmin, ownerUser], currentUserId: actingAdmin.id });

    const result = await useAuthStore.getState().updateUserWorkflowNotificationEvent(ownerUser.id, 'testing', false);

    expect(result).toEqual({
      success: false,
      message: 'Owner workflow alerts must be managed from the owner account settings.',
    });
    expect(updateUserInAirtableMock).not.toHaveBeenCalled();
  });
});