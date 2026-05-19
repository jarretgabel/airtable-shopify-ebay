import { create } from 'zustand';
import { AppPage } from '@/auth/pages';
import { getRoleDefaultPages, hasFullAccessRole, isDeveloperRole } from '@/auth/roleAccess';
import {
  createNotificationPreferencesForRole,
  loadRoleWorkflowNotificationDefaults,
  normalizeNotificationPreferencesForRole,
  syncRoleWorkflowNotificationDefaultsFromAirtable,
  type RoleWorkflowNotificationDefaults,
  updateStoredRoleWorkflowNotificationDefault,
} from '@/services/roleNotificationDefaults';
import {
  confirmEmailChange as confirmEmailChangeViaApi,
  login as loginViaApi,
  logout as logoutViaApi,
  requestEmailChange as requestEmailChangeViaApi,
  requestPasswordReset as requestPasswordResetViaApi,
  resetPassword as resetPasswordViaApi,
  resolveSession as resolveSessionViaApi,
  updatePassword as updatePasswordViaApi,
} from '@/services/app-api/auth';
import {
  createUserInAirtable,
  deleteUserInAirtable,
  normalizePages,
  sendWelcomeEmail,
  loadUsersFromAirtable,
  updateUserInAirtable,
} from './authStorage';
import type { AppUser, CreateUserInput, UserRole } from './authTypes';
import type {
  AccountUpdateResult,
  CreateUserResult,
  LoginResult,
  PasswordResetRequestResult,
  PasswordResetResult,
} from './authContextTypes';
import {
  buildUserFromInput,
  canUserAccessPage,
  getCurrentUser,
  normalizeEmail,
} from './authContextHelpers';
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  type UsedGearWorkflowNotificationEvent,
  type UserNotificationPreferences,
} from './authTypes';
import { validatePasswordPolicy } from './passwordPolicy';

function buildAuthenticatedSessionUser(input: {
  userId: string;
  airtableRecordId?: string;
  name: string;
  email: string;
  role: UserRole;
  allowedPages: AppPage[];
  mustChangePassword: boolean;
}): AppUser {
  return {
    id: input.userId,
    airtableRecordId: input.airtableRecordId,
    name: input.name,
    email: input.email,
    role: input.role,
    mustChangePassword: input.mustChangePassword,
    allowedPages: input.allowedPages,
    notificationPreferences: createNotificationPreferencesForRole(input.role),
  };
}

const SAMPLE_USER_DEFINITIONS: Array<{ id: string; name: string; email: string; role: UserRole; password: string }> = [
  { id: 'u-developer-sample', name: 'Devon Developer', email: 'developer@example.com', role: 'developer', password: 'Developer123!' },
  { id: 'u-processor-sample', name: 'Parker Processor', email: 'processor@example.com', role: 'processor', password: 'Processor123!' },
  { id: 'u-tester-sample', name: 'Taylor Tester', email: 'tester@example.com', role: 'tester', password: 'Tester123!' },
  { id: 'u-photographer-sample', name: 'Phoebe Photographer', email: 'photographer@example.com', role: 'photographer', password: 'Photographer123!' },
];

function isOwnerRoleChangeLocked(currentRole: UserRole, nextRole: UserRole): boolean {
  return currentRole === 'owner' || nextRole === 'owner';
}

async function ensureSampleUsers(users: AppUser[]): Promise<AppUser[]> {
  const normalizedEmails = new Set(users.map((user) => user.email.toLowerCase()));
  const missingDefinitions = SAMPLE_USER_DEFINITIONS.filter((definition) => !normalizedEmails.has(definition.email));

  if (missingDefinitions.length === 0) {
    return users;
  }

  const createdUsers = await Promise.all(missingDefinitions.map(async (definition) => createUserInAirtable({
    id: definition.id,
    name: definition.name,
    email: definition.email,
    role: definition.role,
    password: definition.password,
    mustChangePassword: false,
    allowedPages: getRoleDefaultPages(definition.role),
    notificationPreferences: createNotificationPreferencesForRole(definition.role),
  })));

  return [...users, ...createdUsers].sort((left, right) => left.email.localeCompare(right.email));
}

export interface AuthStoreState {
  users: AppUser[];
  roleNotificationDefaults: RoleWorkflowNotificationDefaults;
  usersLoading: boolean;
  usersReady: boolean;
  currentUserId: string | null;
  hasAuthenticatedSession: boolean;
  requiresPasswordChange: boolean;
  initializeUsers: () => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  canAccessPage: (page: AppPage) => boolean;
  requestPasswordReset: (email: string) => Promise<PasswordResetRequestResult>;
  resetPassword: (token: string, password: string) => Promise<PasswordResetResult>;
  updateUserPermissions: (userId: string, pages: AppPage[]) => Promise<AccountUpdateResult>;
  updateUserRole: (userId: string, role: UserRole) => Promise<AccountUpdateResult>;
  deleteUser: (userId: string) => Promise<AccountUpdateResult>;
  createUser: (input: CreateUserInput) => Promise<CreateUserResult>;
  updateCurrentUserEmail: (email: string, currentPassword: string) => Promise<AccountUpdateResult>;
  confirmEmailChange: (token: string) => Promise<AccountUpdateResult>;
  updateCurrentUserPassword: (currentPassword: string, nextPassword: string) => Promise<AccountUpdateResult>;
  completeRequiredPasswordChange: (nextPassword: string) => Promise<AccountUpdateResult>;
  updateCurrentUserNotificationPreference: <K extends keyof UserNotificationPreferences>(key: K, value: UserNotificationPreferences[K]) => Promise<AccountUpdateResult>;
  updateUserNotificationPreference: <K extends keyof UserNotificationPreferences>(userId: string, key: K, value: UserNotificationPreferences[K]) => Promise<AccountUpdateResult>;
  updateCurrentUserWorkflowNotificationEvent: (eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => Promise<AccountUpdateResult>;
  updateUserWorkflowNotificationEvent: (userId: string, eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => Promise<AccountUpdateResult>;
  updateRoleWorkflowNotificationDefault: (role: UserRole, eventKey: UsedGearWorkflowNotificationEvent, enabled: boolean) => Promise<AccountUpdateResult>;
  applyRoleWorkflowNotificationDefaults: (role: UserRole) => Promise<AccountUpdateResult>;
}

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  users: [],
  roleNotificationDefaults: loadRoleWorkflowNotificationDefaults(),
  usersLoading: false,
  usersReady: false,
  currentUserId: null,
  hasAuthenticatedSession: false,
  requiresPasswordChange: false,
  initializeUsers: async () => {
    const { usersLoading, usersReady } = get();
    if (usersLoading || usersReady) return;

    set({ usersLoading: true });
    try {
      let resolvedUserId: string | null = null;
      let requiresPasswordChange = false;

      try {
        const session = await resolveSessionViaApi();
        resolvedUserId = session.userId;
        requiresPasswordChange = session.mustChangePassword;

        const sessionUser = buildAuthenticatedSessionUser({
          userId: session.userId,
          airtableRecordId: session.airtableRecordId,
          name: session.name,
          email: session.email,
          role: session.role,
          allowedPages: session.allowedPages,
          mustChangePassword: session.mustChangePassword,
        });

        if (!hasFullAccessRole(session.role)) {
          set({
            users: [sessionUser],
            usersReady: true,
            currentUserId: sessionUser.id,
            hasAuthenticatedSession: true,
            requiresPasswordChange: requiresPasswordChange || Boolean(sessionUser.mustChangePassword),
          });
          return;
        }
      } catch {
        resolvedUserId = null;
      }

      if (!resolvedUserId) {
        set({
          users: [],
          usersReady: true,
          currentUserId: null,
          hasAuthenticatedSession: false,
          requiresPasswordChange: false,
        });
        return;
      }

      let users = await loadUsersFromAirtable();
      let roleNotificationDefaults = loadRoleWorkflowNotificationDefaults();

      try {
        roleNotificationDefaults = await syncRoleWorkflowNotificationDefaultsFromAirtable();
      } catch {
        roleNotificationDefaults = loadRoleWorkflowNotificationDefaults();
      }

      let sessionUser = resolvedUserId ? users.find((user) => user.id === resolvedUserId) ?? null : null;
      if (sessionUser && hasFullAccessRole(sessionUser.role)) {
        try {
          users = await ensureSampleUsers(users);
          sessionUser = users.find((user) => user.id === resolvedUserId) ?? sessionUser;
        } catch (error) {
          console.error('Failed to seed sample users:', error);
        }
      }
      set({
        users,
        roleNotificationDefaults,
        usersReady: true,
        currentUserId: sessionUser?.id ?? null,
        hasAuthenticatedSession: Boolean(sessionUser),
        requiresPasswordChange: requiresPasswordChange || Boolean(sessionUser?.mustChangePassword),
      });
    } catch (error) {
      console.error('Failed to load users from Airtable:', error);
      set({ usersReady: true });
    } finally {
      set({ usersLoading: false });
    }
  },
  login: async (email, password) => {
    try {
      const auth = await loginViaApi(email, password);
      const authenticatedUser = buildAuthenticatedSessionUser({
        userId: auth.userId,
        airtableRecordId: auth.airtableRecordId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
        allowedPages: auth.allowedPages,
        mustChangePassword: auth.mustChangePassword,
      });

      if (!hasFullAccessRole(authenticatedUser.role)) {
        set({
          users: [authenticatedUser],
          usersReady: true,
          currentUserId: auth.userId,
          hasAuthenticatedSession: true,
          requiresPasswordChange: auth.mustChangePassword,
        });
        return { success: true, message: 'Login successful.' };
      }

      let latestUsers = await loadUsersFromAirtable();
      if (hasFullAccessRole(authenticatedUser.role)) {
        try {
          latestUsers = await ensureSampleUsers(latestUsers);
        } catch (error) {
          console.error('Failed to seed sample users after login:', error);
        }
      }
      set({
        users: latestUsers,
        usersReady: true,
        currentUserId: auth.userId,
        hasAuthenticatedSession: true,
        requiresPasswordChange: auth.mustChangePassword,
      });
      return { success: true, message: 'Login successful.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed.',
      };
    }
  },
  logout: () => {
    void logoutViaApi().catch(() => undefined);
    set({ currentUserId: null, hasAuthenticatedSession: false, requiresPasswordChange: false });
  },
  canAccessPage: (page) => {
    const { users, currentUserId } = get();
    const currentUser = getCurrentUser(users, currentUserId);
    return canUserAccessPage(currentUser, page);
  },
  requestPasswordReset: async (email) => {
    try {
      return await requestPasswordResetViaApi(email, window.location.origin);
    } catch (error) {
      return {
        sent: true,
        message: error instanceof Error ? error.message : 'If the account exists, a reset email was sent.',
      };
    }
  },
  resetPassword: async (token, password) => {
    try {
      const result = await resetPasswordViaApi(token, password);
      const users = await loadUsersFromAirtable();
      set({ users, requiresPasswordChange: false });
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reset password.',
      };
    }
  },
  updateUserPermissions: async (userId, pages) => {
    const { users } = get();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.role === 'owner') {
      return { success: false, message: 'Owner account access is managed outside User Management.' };
    }

    void pages;
    return {
      success: false,
      message: 'Access is locked to a single role bundle. Change the role instead of editing page permissions.',
    };
  },
  updateUserRole: async (userId, role) => {
    const { users } = get();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (isOwnerRoleChangeLocked(targetUser.role, role)) {
      return { success: false, message: 'Owner role changes must be made with the package script.' };
    }

    const nextUser = {
      ...targetUser,
      role,
      allowedPages: normalizePages(getRoleDefaultPages(role), role),
      notificationPreferences: normalizeNotificationPreferencesForRole(role, targetUser.notificationPreferences),
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === userId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Role updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role in Airtable.',
      };
    }
  },
  deleteUser: async (userId) => {
    const { users, currentUserId } = get();
    const currentUser = getCurrentUser(users, currentUserId);
    if (!currentUser || !hasFullAccessRole(currentUser.role)) {
      return { success: false, message: 'Only admins or owners can delete users.' };
    }

    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (targetUser.id === currentUser.id) {
      return { success: false, message: 'You cannot delete your own account.' };
    }

    if (targetUser.id === 'u-admin') {
      return { success: false, message: 'The main admin account cannot be deleted.' };
    }

    if (targetUser.role === 'owner') {
      return { success: false, message: 'Owner accounts cannot be deleted from the app.' };
    }

    if (targetUser.role === 'admin') {
      const remainingAdmins = users.filter((user) => user.role === 'admin' && user.id !== targetUser.id).length;
      if (remainingAdmins === 0) {
        return { success: false, message: 'Cannot delete the last admin account.' };
      }
    }

    try {
      await deleteUserInAirtable(targetUser);
      const updatedUsers = users.filter((user) => user.id !== targetUser.id);
      set({ users: updatedUsers });
      return { success: true, message: `Deleted user ${targetUser.email}.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user from Airtable.',
      };
    }
  },
  createUser: async (input) => {
    const { users } = get();
    if ((input as { role?: string }).role === 'owner') {
      return { success: false, message: 'Owner accounts must be created with the package script.' };
    }

    const candidate = buildUserFromInput(input);
    if (candidate.result) {
      return candidate.result;
    }

    const newUser = candidate.user;
    if (!newUser) {
      return { success: false, message: 'Could not create user.' };
    }

    if (users.some((user) => user.email.toLowerCase() === newUser.email)) {
      return { success: false, message: 'A user with that email already exists.' };
    }

    try {
      const createdUser = await createUserInAirtable(newUser);
      set({ users: [...users, createdUser] });
      const delivery = await sendWelcomeEmail(newUser.email, newUser.password || '');
      const deliveryNote = delivery === 'gmail' ? 'Welcome email sent.' : 'Welcome email draft opened.';
      return { success: true, message: `User ${createdUser.email} created. ${deliveryNote}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user in Airtable.',
      };
    }
  },
  updateCurrentUserEmail: async (email, currentPassword) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return { success: false, message: 'Email is required.' };
    }

    const { users, currentUserId, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Email changes are disabled for the main admin account.' };
    }

    try {
      const result = await requestEmailChangeViaApi(normalizedEmail, currentPassword, window.location.origin);
      return {
        success: result.success,
        message: result.confirmationLink
          ? isDeveloperRole(currentUser.role)
            ? `${result.message} Development confirmation link: ${result.confirmationLink}`
            : result.message
          : result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to request email change.',
      };
    }
  },
  confirmEmailChange: async (token) => {
    try {
      const result = await confirmEmailChangeViaApi(token);
      const users = await loadUsersFromAirtable();
      set({ users });
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update email.',
      };
    }
  },
  updateCurrentUserPassword: async (currentPassword, nextPassword) => {
    const trimmedNextPassword = nextPassword.trim();
    if (!trimmedNextPassword) {
      return { success: false, message: 'New password is required.' };
    }

    const passwordPolicyError = validatePasswordPolicy(trimmedNextPassword);
    if (passwordPolicyError) {
      return { success: false, message: passwordPolicyError };
    }

    const { users, currentUserId, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (currentUser.id === 'u-admin') {
      return { success: false, message: 'Password changes are disabled for the main admin account.' };
    }

    try {
      const result = await updatePasswordViaApi(trimmedNextPassword, currentPassword);
      const refreshedUsers = await loadUsersFromAirtable();
      set({ users: refreshedUsers, hasAuthenticatedSession: true, requiresPasswordChange: Boolean(result.mustChangePassword) });
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password.',
      };
    }
  },
  completeRequiredPasswordChange: async (nextPassword) => {
    const trimmedNextPassword = nextPassword.trim();
    if (!trimmedNextPassword) {
      return { success: false, message: 'New password is required.' };
    }

    const passwordPolicyError = validatePasswordPolicy(trimmedNextPassword);
    if (passwordPolicyError) {
      return { success: false, message: passwordPolicyError };
    }

    const { users, currentUserId, requiresPasswordChange, hasAuthenticatedSession } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }
    if (!hasAuthenticatedSession) {
      return { success: false, message: 'Session expired. Please log in again.' };
    }

    const currentUser = users.find((user) => user.id === currentUserId);
    if (!currentUser) {
      return { success: false, message: 'Current user was not found.' };
    }

    if (!requiresPasswordChange && !currentUser.mustChangePassword) {
      return { success: false, message: 'Password update is not required for this account.' };
    }

    try {
      const result = await updatePasswordViaApi(trimmedNextPassword);
      const refreshedUsers = await loadUsersFromAirtable();
      set({ users: refreshedUsers, hasAuthenticatedSession: true, requiresPasswordChange: Boolean(result.mustChangePassword) });
      return { success: true, message: result.message };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update password.',
      };
    }
  },
  updateCurrentUserNotificationPreference: async (key, value) => {
    const { currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    return get().updateUserNotificationPreference(currentUserId, key, value);
  },
  updateUserNotificationPreference: async (userId, key, value) => {
    const { users, currentUserId } = get();
    const actingUser = users.find((user) => user.id === currentUserId);
    const targetUser = users.find((user) => user.id === userId);

    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (!actingUser) {
      return { success: false, message: 'No active user session.' };
    }

    if (!hasFullAccessRole(actingUser.role) && actingUser.id !== targetUser.id) {
      return { success: false, message: 'Only admins or owners can update other users.' };
    }

    if (targetUser.role === 'owner' && actingUser.id !== targetUser.id) {
      return { success: false, message: 'Owner notification preferences must be managed from the owner account settings.' };
    }

    const currentPreferences = targetUser.notificationPreferences ?? createNotificationPreferencesForRole(targetUser.role);
    const nextUser = {
      ...targetUser,
      notificationPreferences: {
        ...currentPreferences,
        [key]: value,
      },
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === userId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Notification preference updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update notifications in Airtable.',
      };
    }
  },
  updateCurrentUserWorkflowNotificationEvent: async (eventKey, enabled) => {
    const { currentUserId } = get();
    if (!currentUserId) {
      return { success: false, message: 'No active user session.' };
    }

    return get().updateUserWorkflowNotificationEvent(currentUserId, eventKey, enabled);
  },
  updateUserWorkflowNotificationEvent: async (userId, eventKey, enabled) => {
    const { users, currentUserId } = get();
    const actingUser = users.find((user) => user.id === currentUserId);
    const targetUser = users.find((user) => user.id === userId);

    if (!targetUser) {
      return { success: false, message: 'User not found.' };
    }

    if (!actingUser) {
      return { success: false, message: 'No active user session.' };
    }

    if (!hasFullAccessRole(actingUser.role) && actingUser.id !== targetUser.id) {
      return { success: false, message: 'Only admins or owners can update other users.' };
    }

    if (targetUser.role === 'owner' && actingUser.id !== targetUser.id) {
      return { success: false, message: 'Owner workflow alerts must be managed from the owner account settings.' };
    }

    if (targetUser.role === 'developer') {
      return { success: false, message: 'Developer accounts do not subscribe to used-gear workflow alerts.' };
    }

    const currentPreferences = targetUser.notificationPreferences ?? createNotificationPreferencesForRole(targetUser.role);
    const nextUser = {
      ...targetUser,
      notificationPreferences: {
        ...currentPreferences,
        workflowEvents: {
          ...(currentPreferences.workflowEvents ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.workflowEvents),
          [eventKey]: enabled,
        },
      },
    };

    try {
      const savedUser = await updateUserInAirtable(nextUser);
      const updatedUsers = users.map((user) => (user.id === userId ? savedUser : user));
      set({ users: updatedUsers });
      return { success: true, message: 'Workflow notification preference updated.' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update workflow notifications in Airtable.',
      };
    }
  },
  updateRoleWorkflowNotificationDefault: async (role, eventKey, enabled) => {
    const { users, currentUserId } = get();
    const actingUser = users.find((user) => user.id === currentUserId);
    if (!actingUser || !hasFullAccessRole(actingUser.role)) {
      return { success: false, message: 'Only admins or owners can update role defaults.' };
    }

    if (role === 'owner') {
      return { success: false, message: 'Owner defaults are managed outside the app.' };
    }

    if (role === 'developer') {
      return { success: false, message: 'Developer accounts do not use workflow alert defaults.' };
    }

    try {
      const nextDefaults = await updateStoredRoleWorkflowNotificationDefault(role, eventKey, enabled);
      set({ roleNotificationDefaults: nextDefaults });
      return { success: true, message: `${role[0].toUpperCase()}${role.slice(1)} defaults updated.` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role defaults.',
      };
    }
  },
  applyRoleWorkflowNotificationDefaults: async (role) => {
    const { users, currentUserId, roleNotificationDefaults } = get();
    const actingUser = users.find((user) => user.id === currentUserId);
    if (!actingUser || !hasFullAccessRole(actingUser.role)) {
      return { success: false, message: 'Only admins or owners can apply role defaults.' };
    }

    if (role === 'owner') {
      return { success: false, message: 'Owner defaults are managed outside the app.' };
    }

    if (role === 'developer') {
      return { success: false, message: 'Developer accounts do not use workflow alert defaults.' };
    }

    const matchingUsers = users.filter((user) => user.role === role);
    if (matchingUsers.length === 0) {
      return { success: false, message: `No ${role} users found.` };
    }

    const workflowEvents = roleNotificationDefaults[role];
    const updatedUsers = matchingUsers.map((user) => ({
      ...user,
      notificationPreferences: {
        ...(user.notificationPreferences ?? createNotificationPreferencesForRole(user.role)),
        workflowEvents: { ...workflowEvents },
      },
    }));

    try {
      await Promise.all(updatedUsers.map((user) => updateUserInAirtable(user)));
      const updatedById = new Map(updatedUsers.map((user) => [user.id, user]));
      set({
        users: users.map((user) => updatedById.get(user.id) ?? user),
      });
      return {
        success: true,
        message: `Applied ${role} workflow alert defaults to ${updatedUsers.length} user${updatedUsers.length === 1 ? '' : 's'}.`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply role defaults.',
      };
    }
  },
}));
