import {
  createConfiguredRecord,
  getConfiguredRecords,
  updateConfiguredRecord,
} from '@/services/app-api/airtable';
import {
  createDefaultUserNotificationPreferences,
  type UsedGearWorkflowNotificationEvent,
  type UsedGearWorkflowNotificationPreferences,
  type UserNotificationPreferences,
  type UserRole,
} from '@/stores/auth/authTypes';

export type RoleWorkflowNotificationDefaults = Record<UserRole, UsedGearWorkflowNotificationPreferences>;
export type UserNotificationPreferencesInput = Partial<Omit<UserNotificationPreferences, 'workflowEvents'>> & {
  workflowEvents?: Partial<UsedGearWorkflowNotificationPreferences>;
};

const ROLE_DEFAULTS_RECORD_PREFIX = '__role-defaults__:';
const ROLE_DEFAULTS_EMAIL_DOMAIN = 'internal.invalid';
let roleWorkflowNotificationDefaultsCache = createDefaultRoleWorkflowNotificationDefaults();

function cloneWorkflowPreferences(preferences: UsedGearWorkflowNotificationPreferences): UsedGearWorkflowNotificationPreferences {
  return { ...preferences };
}

export function createDefaultRoleWorkflowNotificationDefaults(): RoleWorkflowNotificationDefaults {
  return {
    admin: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('admin').workflowEvents),
    owner: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('owner').workflowEvents),
    developer: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('developer').workflowEvents),
    processor: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('processor').workflowEvents),
    tester: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('tester').workflowEvents),
    photographer: cloneWorkflowPreferences(createDefaultUserNotificationPreferences('photographer').workflowEvents),
  };
}

function normalizeRoleWorkflowDefaults(value: unknown): RoleWorkflowNotificationDefaults {
  const defaults = createDefaultRoleWorkflowNotificationDefaults();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Partial<Record<UserRole, Partial<UsedGearWorkflowNotificationPreferences>>>;
  return {
    admin: { ...defaults.admin, ...(record.admin ?? {}) },
    owner: { ...defaults.owner, ...(record.owner ?? {}) },
    developer: { ...defaults.developer, ...(record.developer ?? {}) },
    processor: { ...defaults.processor, ...(record.processor ?? {}) },
    tester: { ...defaults.tester, ...(record.tester ?? {}) },
    photographer: { ...defaults.photographer, ...(record.photographer ?? {}) },
  };
}

function cloneRoleDefaults(defaults: RoleWorkflowNotificationDefaults): RoleWorkflowNotificationDefaults {
  return {
    admin: cloneWorkflowPreferences(defaults.admin),
    owner: cloneWorkflowPreferences(defaults.owner),
    developer: cloneWorkflowPreferences(defaults.developer),
    processor: cloneWorkflowPreferences(defaults.processor),
    tester: cloneWorkflowPreferences(defaults.tester),
    photographer: cloneWorkflowPreferences(defaults.photographer),
  };
}

function getRoleDefaultsRecordId(role: UserRole): string {
  return `${ROLE_DEFAULTS_RECORD_PREFIX}${role}`;
}

function getRoleDefaultsRecordEmail(role: UserRole): string {
  return `role-defaults+${role}@${ROLE_DEFAULTS_EMAIL_DOMAIN}`;
}

function toSingleString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((entry): entry is string => typeof entry === 'string');
    return firstString?.trim() ?? '';
  }

  return '';
}

function getNotificationsFieldValue(fields: Record<string, unknown>): unknown {
  if ('Notifications' in fields) {
    return fields.Notifications;
  }

  const matchedKey = Object.keys(fields).find((key) => key.trim().toLowerCase() === 'notifications');
  return matchedKey ? fields[matchedKey] : undefined;
}

function parseRoleDefaultsRecord(
  record: { id: string; fields: Record<string, unknown> },
): { role: UserRole; workflowEvents: Partial<UsedGearWorkflowNotificationPreferences> } | null {
  const recordKey = toSingleString(record.fields['User Id'] ?? record.fields['User ID'] ?? record.fields.ID) || record.id;
  if (!recordKey.startsWith(ROLE_DEFAULTS_RECORD_PREFIX)) {
    return null;
  }

  const role = recordKey.slice(ROLE_DEFAULTS_RECORD_PREFIX.length) as UserRole;
  if (!['admin', 'owner', 'developer', 'processor', 'tester', 'photographer'].includes(role)) {
    return null;
  }

  const rawNotifications = getNotificationsFieldValue(record.fields);
  if (!rawNotifications) {
    return { role, workflowEvents: {} };
  }

  try {
    const parsed = typeof rawNotifications === 'string'
      ? JSON.parse(rawNotifications) as { workflowEvents?: Partial<UsedGearWorkflowNotificationPreferences> }
      : rawNotifications as { workflowEvents?: Partial<UsedGearWorkflowNotificationPreferences> };
    return {
      role,
      workflowEvents: parsed.workflowEvents ?? {},
    };
  } catch {
    return { role, workflowEvents: {} };
  }
}

function buildRoleDefaultsRecordFields(role: UserRole, workflowEvents: UsedGearWorkflowNotificationPreferences): Record<string, unknown> {
  return {
    'User Id': getRoleDefaultsRecordId(role),
    Name: `Role Workflow Defaults: ${role}`,
    Email: getRoleDefaultsRecordEmail(role),
    Role: role,
    Notifications: JSON.stringify({ workflowEvents }),
  };
}

export function loadRoleWorkflowNotificationDefaults(): RoleWorkflowNotificationDefaults {
  return cloneRoleDefaults(roleWorkflowNotificationDefaultsCache);
}

export function setRoleWorkflowNotificationDefaults(defaults: RoleWorkflowNotificationDefaults): RoleWorkflowNotificationDefaults {
  roleWorkflowNotificationDefaultsCache = normalizeRoleWorkflowDefaults(defaults);
  return loadRoleWorkflowNotificationDefaults();
}

export function getRoleWorkflowNotificationDefaults(role: UserRole): UsedGearWorkflowNotificationPreferences {
  return cloneWorkflowPreferences(loadRoleWorkflowNotificationDefaults()[role]);
}

export async function syncRoleWorkflowNotificationDefaultsFromAirtable(): Promise<RoleWorkflowNotificationDefaults> {
  const defaults = createDefaultRoleWorkflowNotificationDefaults();
  const records = await getConfiguredRecords('users');
  records.forEach((record) => {
    const parsed = parseRoleDefaultsRecord(record);
    if (!parsed) {
      return;
    }

    defaults[parsed.role] = {
      ...defaults[parsed.role],
      ...parsed.workflowEvents,
    };
  });

  return setRoleWorkflowNotificationDefaults(defaults);
}

export async function updateStoredRoleWorkflowNotificationDefault(
  role: UserRole,
  eventKey: UsedGearWorkflowNotificationEvent,
  enabled: boolean,
): Promise<RoleWorkflowNotificationDefaults> {
  const defaults = loadRoleWorkflowNotificationDefaults();
  const nextDefaults = {
    ...defaults,
    [role]: {
      ...defaults[role],
      [eventKey]: enabled,
    },
  } satisfies RoleWorkflowNotificationDefaults;

  const records = await getConfiguredRecords('users');
  const existingRecord = records.find((record) => {
    const recordKey = toSingleString(record.fields['User Id'] ?? record.fields['User ID'] ?? record.fields.ID) || record.id;
    return recordKey === getRoleDefaultsRecordId(role);
  });
  const fields = buildRoleDefaultsRecordFields(role, nextDefaults[role]);

  if (existingRecord) {
    await updateConfiguredRecord('users', existingRecord.id, fields, { typecast: true });
  } else {
    await createConfiguredRecord('users', fields, { typecast: true });
  }

  return setRoleWorkflowNotificationDefaults(nextDefaults);
}

export function createNotificationPreferencesForRole(role: UserRole): UserNotificationPreferences {
  const basePreferences = createDefaultUserNotificationPreferences(role);
  return {
    ...basePreferences,
    workflowEvents: getRoleWorkflowNotificationDefaults(role),
  };
}

export function normalizeNotificationPreferencesForRole(
  role: UserRole,
  value: UserNotificationPreferencesInput | undefined,
): UserNotificationPreferences {
  const roleDefaults = createNotificationPreferencesForRole(role);
  return {
    infoEnabled: value?.infoEnabled ?? roleDefaults.infoEnabled,
    successEnabled: value?.successEnabled ?? roleDefaults.successEnabled,
    warningEnabled: value?.warningEnabled ?? roleDefaults.warningEnabled,
    errorEnabled: value?.errorEnabled ?? roleDefaults.errorEnabled,
    autoDismissMs: value?.autoDismissMs ?? roleDefaults.autoDismissMs,
    workflowAssignedAlertsEnabled: value?.workflowAssignedAlertsEnabled ?? roleDefaults.workflowAssignedAlertsEnabled,
    workflowUnassignedAlertsEnabled: value?.workflowUnassignedAlertsEnabled ?? roleDefaults.workflowUnassignedAlertsEnabled,
    workflowEvents: {
      ...roleDefaults.workflowEvents,
      ...(value?.workflowEvents ?? {}),
    },
  };
}