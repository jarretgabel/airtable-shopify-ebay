import { HttpError } from '../../shared/errors.js';
import { APP_PAGES, isAppPage, normalizeAllowedPages, type AppPage, type UserRole } from '../../shared/appPages.js';
import { createConfiguredRecord, getConfiguredRecords, updateConfiguredRecord } from '../airtable/sources.js';
import { parseStoredPasswordField, serializePasswordField, verifyStoredPassword, type StoredPasswordState } from './passwords.js';

const USER_FIELD_KEYS = {
  id: ['User Id', 'User ID', 'ID'],
  name: ['Name'],
  email: ['Email'],
  role: ['Role'],
  password: ['Password'],
  mustChangePassword: ['MustChangePassword', 'Must Change Password'],
  allowedPages: ['Allowed Pages', 'AllowedPages'],
} as const;
const ROLE_DEFAULTS_RECORD_PREFIX = '__role-defaults__:';

const SAMPLE_AUTH_USER_DEFINITIONS: Array<{
  id: string;
  name: string;
  email: string;
  role: Extract<UserRole, 'developer' | 'processor' | 'tester' | 'photographer'>;
  password: string;
}> = [
  { id: 'u-developer-sample', name: 'Devon Developer', email: 'developer@example.com', role: 'developer', password: 'Developer123!' },
  { id: 'u-processor-sample', name: 'Parker Processor', email: 'processor@example.com', role: 'processor', password: 'Processor123!' },
  { id: 'u-tester-sample', name: 'Taylor Tester', email: 'tester@example.com', role: 'tester', password: 'Tester123!' },
  { id: 'u-photographer-sample', name: 'Phoebe Photographer', email: 'photographer@example.com', role: 'photographer', password: 'Photographer123!' },
];

export interface AuthUserRecord {
  id: string;
  airtableRecordId: string;
  name: string;
  email: string;
  role: UserRole;
  passwordState: StoredPasswordState;
  mustChangePassword: boolean;
  allowedPages: AppPage[];
}

export const authUserDependencies = {
  createConfiguredRecord,
  updateConfiguredRecord,
};

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase();
}

function getFieldValue(fields: Record<string, unknown>, candidates: readonly string[]): unknown {
  for (const candidate of candidates) {
    if (candidate in fields) {
      return fields[candidate];
    }

    const matched = Object.keys(fields).find((key) => normalizeFieldName(key) === normalizeFieldName(candidate));
    if (matched) {
      return fields[matched];
    }
  }

  return undefined;
}

function toSingleString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((entry): entry is string => typeof entry === 'string');
    return firstString?.trim() ?? '';
  }

  return '';
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function parseRole(value: unknown): UserRole {
  const normalized = toSingleString(value).toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'owner') return 'owner';
  if (normalized === 'developer') return 'developer';
  if (normalized === 'tester') return 'tester';
  if (normalized === 'photographer') return 'photographer';
  return 'processor';
}

function isRoleDefaultsRecordId(value: string): boolean {
  return value.trim().startsWith(ROLE_DEFAULTS_RECORD_PREFIX);
}

function parseAllowedPages(value: unknown, role: UserRole): AppPage[] {
  if (role === 'admin' || role === 'owner') {
    return [...APP_PAGES];
  }

  if (Array.isArray(value)) {
    return normalizeAllowedPages(
      value.filter((entry): entry is string => typeof entry === 'string').filter(isAppPage),
      role,
    );
  }

  const raw = toSingleString(value);
  if (!raw) {
    return [];
  }

  return normalizeAllowedPages(
    raw.split(',').map((entry) => entry.trim()).filter(isAppPage),
    role,
  );
}

function isMissingMustChangePasswordFieldError(error: unknown): boolean {
  return error instanceof HttpError
    && error.service === 'airtable'
    && error.code === 'AIRTABLE_HTTP_ERROR'
    && /Unknown field name:\s*"MustChangePassword"/i.test(error.message);
}

function getUnknownFieldName(error: unknown): string | undefined {
  if (!(error instanceof HttpError) || error.service !== 'airtable' || error.code !== 'AIRTABLE_HTTP_ERROR') {
    return undefined;
  }

  const match = error.message.match(/Unknown field name:\s*"([^"]+)"/i);
  return match?.[1];
}

function mapUserRecord(recordId: string, fields: Record<string, unknown>): AuthUserRecord | null {
  const id = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.id)) || recordId;
  if (isRoleDefaultsRecordId(id)) {
    return null;
  }
  const email = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.email)).toLowerCase();
  if (!email) {
    return null;
  }
  const name = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.name)) || email || id;

  const role = parseRole(getFieldValue(fields, USER_FIELD_KEYS.role));
  const passwordState = parseStoredPasswordField(getFieldValue(fields, USER_FIELD_KEYS.password));
  const mustChangePassword = parseBoolean(getFieldValue(fields, USER_FIELD_KEYS.mustChangePassword)) || Boolean(passwordState.mustChangePassword);
  const allowedPages = parseAllowedPages(getFieldValue(fields, USER_FIELD_KEYS.allowedPages), role);

  return {
    id,
    airtableRecordId: recordId,
    name,
    email,
    role,
    passwordState,
    mustChangePassword,
    allowedPages,
  };
}

export async function loadAuthUsers(): Promise<AuthUserRecord[]> {
  const records = await getConfiguredRecords('users');
  return records
    .map((record) => mapUserRecord(record.id, record.fields))
    .filter((record): record is AuthUserRecord => Boolean(record));
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const users = await loadAuthUsers();
  return users.find((user) => user.email === normalizedEmail) ?? null;
}

export async function findAuthUserById(userId: string): Promise<AuthUserRecord | null> {
  const normalizedId = userId.trim();
  if (!normalizedId) {
    return null;
  }

  const users = await loadAuthUsers();
  return users.find((user) => user.id === normalizedId) ?? null;
}

export async function updateAuthUserPassword(user: AuthUserRecord, password: string, mustChangePassword: boolean): Promise<void> {
  const passwordFieldValue = serializePasswordField(password, mustChangePassword);

  try {
    await authUserDependencies.updateConfiguredRecord('users', user.airtableRecordId, {
      [USER_FIELD_KEYS.password[0]]: passwordFieldValue,
      [USER_FIELD_KEYS.mustChangePassword[0]]: mustChangePassword,
    }, { typecast: true });
  } catch (error) {
    if (!isMissingMustChangePasswordFieldError(error)) {
      throw error;
    }

    await authUserDependencies.updateConfiguredRecord('users', user.airtableRecordId, {
      [USER_FIELD_KEYS.password[0]]: passwordFieldValue,
    }, { typecast: true });
  }
}

export async function updateAuthUserEmail(user: AuthUserRecord, nextEmail: string): Promise<void> {
  const normalizedEmail = nextEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new HttpError(400, 'Email is required', {
      service: 'auth',
      code: 'AUTH_EMAIL_REQUIRED',
      retryable: false,
    });
  }

  await updateConfiguredRecord('users', user.airtableRecordId, {
    [USER_FIELD_KEYS.email[0]]: normalizedEmail,
  }, { typecast: true });
}

async function createAuthUserRecord(fields: Record<string, unknown>): Promise<void> {
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await authUserDependencies.createConfiguredRecord('users', writableFields, { typecast: true });
      return;
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }

      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to create auth user after removing unsupported fields.');
}

async function updateAuthUserRecord(recordId: string, fields: Record<string, unknown>): Promise<void> {
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await authUserDependencies.updateConfiguredRecord('users', recordId, writableFields, { typecast: true });
      return;
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }

      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to update auth user after removing unsupported fields.');
}

function buildSampleAllowedPages(role: Extract<UserRole, 'developer' | 'processor' | 'tester' | 'photographer'>): string {
  return normalizeAllowedPages([...APP_PAGES], role).join(',');
}

function buildSampleUserFields(definition: (typeof SAMPLE_AUTH_USER_DEFINITIONS)[number]): Record<string, unknown> {
  return {
    [USER_FIELD_KEYS.id[0]]: definition.id,
    [USER_FIELD_KEYS.name[0]]: definition.name,
    [USER_FIELD_KEYS.email[0]]: definition.email,
    [USER_FIELD_KEYS.role[0]]: definition.role,
    [USER_FIELD_KEYS.password[0]]: serializePasswordField(definition.password, false),
    [USER_FIELD_KEYS.mustChangePassword[0]]: false,
    [USER_FIELD_KEYS.allowedPages[0]]: buildSampleAllowedPages(definition.role),
  };
}

export async function ensureSampleAuthUsers(users: AuthUserRecord[]): Promise<void> {
  const existingUsersByEmail = new Map(users.map((user) => [user.email, user]));

  for (const definition of SAMPLE_AUTH_USER_DEFINITIONS) {
    const existingUser = existingUsersByEmail.get(definition.email);
    const sampleFields = buildSampleUserFields(definition);

    if (!existingUser) {
      await createAuthUserRecord(sampleFields);
      continue;
    }

    const expectedAllowedPages = buildSampleAllowedPages(definition.role);
    const currentAllowedPages = normalizeAllowedPages(existingUser.allowedPages, existingUser.role).join(',');
    const passwordMatches = verifyStoredPassword(definition.password, existingUser.passwordState);
    const needsSync = existingUser.role !== definition.role
      || existingUser.mustChangePassword
      || currentAllowedPages !== expectedAllowedPages
      || !passwordMatches;

    if (needsSync) {
      await updateAuthUserRecord(existingUser.airtableRecordId, sampleFields);
    }
  }
}