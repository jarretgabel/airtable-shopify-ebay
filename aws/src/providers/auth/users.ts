import { HttpError } from '../../shared/errors.js';
import { APP_PAGES, isAppPage, normalizeAllowedPages, type AppPage, type UserRole } from '../../shared/appPages.js';
import { getConfiguredRecords, updateConfiguredRecord } from '../airtable/sources.js';
import { parseStoredPasswordField, serializePasswordField, type StoredPasswordState } from './passwords.js';

const USER_FIELD_KEYS = {
  id: ['User Id', 'User ID', 'ID'],
  email: ['Email'],
  role: ['Role'],
  password: ['Password'],
  mustChangePassword: ['MustChangePassword', 'Must Change Password'],
  allowedPages: ['Allowed Pages', 'AllowedPages'],
} as const;

export interface AuthUserRecord {
  id: string;
  airtableRecordId: string;
  email: string;
  role: UserRole;
  passwordState: StoredPasswordState;
  mustChangePassword: boolean;
  allowedPages: AppPage[];
}

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
  return toSingleString(value).toLowerCase() === 'admin' ? 'admin' : 'user';
}

function parseAllowedPages(value: unknown, role: UserRole): AppPage[] {
  if (role === 'admin') {
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

function mapUserRecord(recordId: string, fields: Record<string, unknown>): AuthUserRecord | null {
  const id = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.id)) || recordId;
  const email = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.email)).toLowerCase();
  if (!email) {
    return null;
  }

  const role = parseRole(getFieldValue(fields, USER_FIELD_KEYS.role));
  const passwordState = parseStoredPasswordField(getFieldValue(fields, USER_FIELD_KEYS.password));
  const mustChangePassword = parseBoolean(getFieldValue(fields, USER_FIELD_KEYS.mustChangePassword)) || Boolean(passwordState.mustChangePassword);
  const allowedPages = parseAllowedPages(getFieldValue(fields, USER_FIELD_KEYS.allowedPages), role);

  return {
    id,
    airtableRecordId: recordId,
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
  await updateConfiguredRecord(user.airtableRecordId ? 'users' : 'users', user.airtableRecordId, {
    [USER_FIELD_KEYS.password[0]]: serializePasswordField(password, mustChangePassword),
    [USER_FIELD_KEYS.mustChangePassword[0]]: mustChangePassword,
  }, { typecast: true });
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