import { APP_PAGES, AppPage } from '@/auth/pages';
import {
  createConfiguredRecord,
  deleteConfiguredRecord,
  getConfiguredRecords,
  updateConfiguredRecord,
} from '@/services/app-api/airtable';
import { sendPlainTextEmail } from '@/services/app-api/gmail';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser, type UserNotificationPreferences, type UserRole } from './authTypes';

const USER_FIELD_KEYS = {
  id: ['User Id', 'User ID', 'ID'],
  name: ['Name'],
  email: ['Email'],
  role: ['Role'],
  password: ['Password'],
  mustChangePassword: ['MustChangePassword', 'Must Change Password'],
  allowedPages: ['Allowed Pages', 'AllowedPages'],
  notifications: ['Notifications'],
  createdAt: ['Created At', 'CreatedAt'],
  updatedAt: ['Updated At', 'UpdatedAt'],
} as const;

const PASSWORD_FIELD_PAYLOAD_PREFIX = '__LCC_PASSWORD__:';
const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210000;

interface StoredPasswordPayload {
  scheme?: string;
  iterations?: number;
  salt?: string;
  hash?: string;
  password?: string;
  mustChangePassword?: boolean;
}

function getUnknownFieldName(error: unknown): string | undefined {
  const responseStatus = (error as { response?: { status?: number } })?.response?.status;
  const statusCode = (error as { statusCode?: number })?.statusCode;
  const status = responseStatus ?? statusCode;
  if (status !== 422) {
    return undefined;
  }

  const payloadMessage = (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
  const message = payloadMessage ?? (error as { message?: string })?.message ?? '';
  const match = message.match(/Unknown field name:\s*"([^"]+)"/i);
  return match?.[1];
}

function toDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
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

function parseRole(value: unknown): UserRole {
  return toSingleString(value).toLowerCase() === 'admin' ? 'admin' : 'user';
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

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const binary = atob(trimmed);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return trimmed;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function parsePasswordField(value: unknown): { mustChangePassword?: boolean } {
  const decoded = decodeBase64(toSingleString(value));
  if (!decoded.startsWith(PASSWORD_FIELD_PAYLOAD_PREFIX)) {
    return {};
  }

  try {
    const parsed = JSON.parse(decoded.slice(PASSWORD_FIELD_PAYLOAD_PREFIX.length)) as StoredPasswordPayload;
    return {
      mustChangePassword: typeof parsed.mustChangePassword === 'boolean' ? parsed.mustChangePassword : undefined,
    };
  } catch {
    return {};
  }
}

async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure password hashing is unavailable in this browser.');
  }

  const saltBytes = cryptoApi.getRandomValues(new Uint8Array(16));
  const key = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: PASSWORD_HASH_ITERATIONS,
    },
    key,
    256,
  );

  return {
    salt: bytesToBase64(saltBytes),
    hash: bytesToBase64(new Uint8Array(derivedBits)),
  };
}

async function serializePasswordField(password: string, mustChangePassword: boolean): Promise<string> {
  const { salt, hash } = await hashPassword(password);

  return encodeBase64(
    `${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({
      scheme: PASSWORD_HASH_SCHEME,
      iterations: PASSWORD_HASH_ITERATIONS,
      salt,
      hash,
      mustChangePassword,
    } satisfies StoredPasswordPayload)}`,
  );
}

function parseAllowedPages(value: unknown, role: UserRole): AppPage[] {
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  if (Array.isArray(value)) {
    const pages = value
      .filter((entry): entry is string => typeof entry === 'string')
      .map(normalizeLegacyPageValue)
      .filter(isAppPage);
    return normalizePages(pages, role);
  }

  const raw = toSingleString(value);
  if (!raw) return [];

  const pages = raw
    .split(',')
    .map((page) => page.trim())
    .map(normalizeLegacyPageValue)
    .filter(isAppPage);

  return normalizePages(pages, role);
}

function parseNotificationPreferences(value: unknown): UserNotificationPreferences {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeNotificationPreferences(value as Partial<UserNotificationPreferences>);
  }

  const raw = toSingleString(value);
  if (!raw) {
    return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserNotificationPreferences>;
    return normalizeNotificationPreferences(parsed);
  } catch {
    return { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
  }
}

function serializeAllowedPages(user: AppUser): string {
  if (user.role === 'admin') {
    return APP_PAGES.join(',');
  }

  return normalizePages(user.allowedPages, user.role).join(',');
}

async function serializeUserFields(user: AppUser, includeCreatedAt: boolean): Promise<Record<string, unknown>> {
  const today = toDateStamp();
  const mustChangePassword = user.mustChangePassword ?? false;
  const passwordField = user.password
    ? { [USER_FIELD_KEYS.password[0]]: await serializePasswordField(user.password, mustChangePassword) }
    : {};

  return {
    [USER_FIELD_KEYS.id[0]]: user.id,
    [USER_FIELD_KEYS.name[0]]: user.name,
    [USER_FIELD_KEYS.email[0]]: user.email,
    [USER_FIELD_KEYS.role[0]]: user.role,
    ...passwordField,
    [USER_FIELD_KEYS.mustChangePassword[0]]: mustChangePassword,
    [USER_FIELD_KEYS.allowedPages[0]]: serializeAllowedPages(user),
    [USER_FIELD_KEYS.notifications[0]]: JSON.stringify(user.notificationPreferences),
    [USER_FIELD_KEYS.updatedAt[0]]: today,
    ...(includeCreatedAt ? { [USER_FIELD_KEYS.createdAt[0]]: today } : {}),
  };
}

async function getUserRecordsFromAirtable(): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const records = await getConfiguredRecords('users');
  return records.map((record) => ({ id: record.id, fields: record.fields }));
}

async function createUserRecordInAirtable(fields: Record<string, unknown>): Promise<{ id: string; fields: Record<string, unknown> }> {
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await createConfiguredRecord('users', writableFields, { typecast: true });
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to create user in Airtable after removing unsupported fields.');
}

async function updateUserRecordInAirtable(recordId: string, fields: Record<string, unknown>): Promise<{ id: string; fields: Record<string, unknown> }> {
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await updateConfiguredRecord('users', recordId, writableFields, { typecast: true });
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to update user in Airtable after removing unsupported fields.');
}

async function deleteUserRecordInAirtable(recordId: string): Promise<void> {
  await deleteConfiguredRecord('users', recordId);
}

function mapRecordToUser(recordId: string, fields: Record<string, unknown>): AppUser {
  const role = parseRole(getFieldValue(fields, USER_FIELD_KEYS.role));
  const parsedId = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.id)) || recordId;
  const name = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.name)) || 'Unknown User';
  const email = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.email)).toLowerCase();
  const passwordState = parsePasswordField(getFieldValue(fields, USER_FIELD_KEYS.password));
  const mustChangePassword = parseBoolean(getFieldValue(fields, USER_FIELD_KEYS.mustChangePassword)) || Boolean(passwordState.mustChangePassword);
  const allowedPages = parseAllowedPages(getFieldValue(fields, USER_FIELD_KEYS.allowedPages), role);
  const notificationPreferences = parseNotificationPreferences(getFieldValue(fields, USER_FIELD_KEYS.notifications));

  return {
    id: parsedId,
    airtableRecordId: recordId,
    name,
    email,
    role,
    mustChangePassword,
    allowedPages,
    notificationPreferences,
  };
}

export async function loadUsersFromAirtable(): Promise<AppUser[]> {
  const records = await getUserRecordsFromAirtable();

  return records
    .map((record) => mapRecordToUser(record.id, record.fields))
    .filter((user) => Boolean(user.email));
}

export async function createUserInAirtable(user: AppUser): Promise<AppUser> {
  const created = await createUserRecordInAirtable(await serializeUserFields(user, true));
  return {
    ...user,
    airtableRecordId: created.id,
    password: undefined,
  };
}

export async function updateUserInAirtable(user: AppUser): Promise<AppUser> {
  if (!user.airtableRecordId) {
    throw new Error(`Missing Airtable record id for user ${user.email}.`);
  }

  await updateUserRecordInAirtable(user.airtableRecordId, await serializeUserFields(user, false));
  return user;
}

export async function deleteUserInAirtable(user: AppUser): Promise<void> {
  if (!user.airtableRecordId) {
    throw new Error(`Missing Airtable record id for user ${user.email}.`);
  }

  await deleteUserRecordInAirtable(user.airtableRecordId);
}

function isAppPage(value: string): value is AppPage {
  return APP_PAGES.includes(value as AppPage);
}

function normalizeLegacyPageValue(value: string): string {
  return value === 'airtable' ? 'inventory' : value;
}

export function normalizePages(pages: AppPage[], role: UserRole): AppPage[] {
  const unique = Array.from(new Set(pages.filter(isAppPage)));
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  return unique.filter((page) => page !== 'users' && page !== 'settings' && page !== 'notifications');
}

function normalizeNotificationPreferences(value: Partial<UserNotificationPreferences> | undefined): UserNotificationPreferences {
  return {
    infoEnabled: value?.infoEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.infoEnabled,
    successEnabled: value?.successEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.successEnabled,
    warningEnabled: value?.warningEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.warningEnabled,
    errorEnabled: value?.errorEnabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.errorEnabled,
    autoDismissMs: value?.autoDismissMs ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.autoDismissMs,
  };
}

export function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const pool = upper + lower + digits + symbols;

  const randomFrom = (source: string): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint32Array(1);
      crypto.getRandomValues(bytes);
      return source[bytes[0] % source.length];
    }

    return source[Math.floor(Math.random() * source.length)];
  };

  const chars = [
    randomFrom(upper),
    randomFrom(lower),
    randomFrom(digits),
    randomFrom(symbols),
    ...Array.from({ length: Math.max(0, length - 4) }, () => randomFrom(pool)),
  ];

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

function buildWelcomeEmailBody(temporaryPassword: string): string {
  const loginUrl = `${window.location.origin}/login`;

  return [
    'Your account has been created.',
    '',
    `Temporary password: ${temporaryPassword}`,
    `Login URL: ${loginUrl}`,
    '',
    'Please log in and change your password immediately.',
  ].join('\n');
}

export function openWelcomeEmailDraft(email: string, temporaryPassword: string): void {
  const subject = encodeURIComponent('Your account is ready - temporary password inside');
  const body = encodeURIComponent(buildWelcomeEmailBody(temporaryPassword));

  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
}

export async function sendWelcomeEmail(email: string, temporaryPassword: string): Promise<'gmail' | 'draft'> {
  const subject = 'Your account is ready - temporary password inside';
  const body = buildWelcomeEmailBody(temporaryPassword);

  try {
    const sent = await sendPlainTextEmail(email, subject, body);
    if (sent) {
      return 'gmail';
    }
  } catch {
    // Fall back to a mailto draft when Gmail API is unavailable.
  }

  openWelcomeEmailDraft(email, temporaryPassword);
  return 'draft';
}
