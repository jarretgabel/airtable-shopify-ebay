import { APP_PAGES, AppPage } from '@/auth/pages';
import airtableService from '@/services/airtable';
import { DEFAULT_USER_NOTIFICATION_PREFERENCES, type AppUser, type EmailChangeToken, type PasswordResetToken, type UserNotificationPreferences, type UserRole } from './authTypes';

export const USERS_KEY = 'listing-control-center.users';
export const SESSION_KEY = 'listing-control-center.session';
export const RESET_KEY = 'listing-control-center.reset-tokens';
export const EMAIL_CHANGE_KEY = 'listing-control-center.email-change-tokens';
const DEFAULT_USERS_TABLE_NAME = 'j2Gt9USORo6Vi5';

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

interface StoredPasswordPayload {
  password: string;
  mustChangePassword?: boolean;
}

function getUnknownFieldName(error: unknown): string | undefined {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const payload = (error as { response?: { data?: { error?: { type?: string; message?: string } } } })?.response?.data;
  if (status !== 422 || payload?.error?.type !== 'UNKNOWN_FIELD_NAME') {
    return undefined;
  }

  const message = payload.error.message ?? '';
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

function serializePasswordField(password: string, mustChangePassword: boolean): string {
  return encodeBase64(
    `${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({ password, mustChangePassword } satisfies StoredPasswordPayload)}`,
  );
}

function parsePasswordField(value: unknown): { password: string; mustChangePassword?: boolean } {
  const decoded = decodeBase64(toSingleString(value));
  if (!decoded.startsWith(PASSWORD_FIELD_PAYLOAD_PREFIX)) {
    return { password: decoded };
  }

  try {
    const parsed = JSON.parse(decoded.slice(PASSWORD_FIELD_PAYLOAD_PREFIX.length)) as StoredPasswordPayload;
    return {
      password: typeof parsed.password === 'string' ? parsed.password : '',
      mustChangePassword: typeof parsed.mustChangePassword === 'boolean' ? parsed.mustChangePassword : undefined,
    };
  } catch {
    return { password: decoded };
  }
}

function parseAllowedPages(value: unknown, role: UserRole): AppPage[] {
  if (role === 'admin') {
    return [...APP_PAGES];
  }

  if (Array.isArray(value)) {
    const pages = value.filter((entry): entry is AppPage => typeof entry === 'string' && isAppPage(entry));
    return normalizePages(pages, role);
  }

  const raw = toSingleString(value);
  if (!raw) return [];

  const pages = raw
    .split(',')
    .map((page) => page.trim())
    .filter((page): page is AppPage => isAppPage(page));

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

function serializeUserFields(user: AppUser, includeCreatedAt: boolean): Record<string, unknown> {
  const today = toDateStamp();
  const mustChangePassword = user.mustChangePassword ?? false;

  return {
    [USER_FIELD_KEYS.id[0]]: user.id,
    [USER_FIELD_KEYS.name[0]]: user.name,
    [USER_FIELD_KEYS.email[0]]: user.email,
    [USER_FIELD_KEYS.role[0]]: user.role,
    [USER_FIELD_KEYS.password[0]]: serializePasswordField(user.password, mustChangePassword),
    [USER_FIELD_KEYS.mustChangePassword[0]]: mustChangePassword,
    [USER_FIELD_KEYS.allowedPages[0]]: serializeAllowedPages(user),
    [USER_FIELD_KEYS.notifications[0]]: JSON.stringify(user.notificationPreferences),
    [USER_FIELD_KEYS.updatedAt[0]]: today,
    ...(includeCreatedAt ? { [USER_FIELD_KEYS.createdAt[0]]: today } : {}),
  };
}

function getUsersTableReference(): { reference?: string; tableName: string } {
  const envReference = (import.meta.env.VITE_AIRTABLE_USERS_TABLE_REF as string | undefined)?.trim();
  const envTableName = (import.meta.env.VITE_AIRTABLE_USERS_TABLE_NAME as string | undefined)?.trim();

  if (envReference && !envReference.includes('/')) {
    return { tableName: envReference };
  }

  return {
    reference: envReference,
    tableName: envTableName || DEFAULT_USERS_TABLE_NAME,
  };
}

async function getUserRecordsFromAirtable(): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const { reference, tableName } = getUsersTableReference();
  if (reference) {
    const records = await airtableService.getRecordsFromReference(reference, tableName);
    return records.map((record) => ({ id: record.id, fields: record.fields }));
  }

  const records = await airtableService.getRecords(tableName);
  return records.map((record) => ({ id: record.id, fields: record.fields }));
}

async function createUserRecordInAirtable(fields: Record<string, unknown>): Promise<{ id: string; fields: Record<string, unknown> }> {
  const writableFields = { ...fields };
  const { reference, tableName } = getUsersTableReference();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      if (reference) {
        return await airtableService.createRecordFromReference(reference, tableName, writableFields, { typecast: true });
      }

      return await airtableService.createRecord(tableName, writableFields, { typecast: true });
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
  const { reference, tableName } = getUsersTableReference();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      if (reference) {
        return await airtableService.updateRecordFromReference(reference, tableName, recordId, writableFields, { typecast: true });
      }

      return await airtableService.updateRecord(tableName, recordId, writableFields, { typecast: true });
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
  const { reference, tableName } = getUsersTableReference();
  if (reference) {
    await airtableService.deleteRecordFromReference(reference, tableName, recordId);
    return;
  }

  await airtableService.deleteRecord(tableName, recordId);
}

function mapRecordToUser(recordId: string, fields: Record<string, unknown>): AppUser {
  const role = parseRole(getFieldValue(fields, USER_FIELD_KEYS.role));
  const parsedId = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.id)) || recordId;
  const name = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.name)) || 'Unknown User';
  const email = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.email)).toLowerCase();
  const passwordState = parsePasswordField(getFieldValue(fields, USER_FIELD_KEYS.password));
  const password = passwordState.password;
  const mustChangePassword = parseBoolean(getFieldValue(fields, USER_FIELD_KEYS.mustChangePassword)) || Boolean(passwordState.mustChangePassword);
  const allowedPages = parseAllowedPages(getFieldValue(fields, USER_FIELD_KEYS.allowedPages), role);
  const notificationPreferences = parseNotificationPreferences(getFieldValue(fields, USER_FIELD_KEYS.notifications));

  return {
    id: parsedId,
    airtableRecordId: recordId,
    name,
    email,
    role,
    password,
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
  const created = await createUserRecordInAirtable(serializeUserFields(user, true));
  return {
    ...user,
    airtableRecordId: created.id,
  };
}

export async function updateUserInAirtable(user: AppUser): Promise<AppUser> {
  if (!user.airtableRecordId) {
    throw new Error(`Missing Airtable record id for user ${user.email}.`);
  }

  await updateUserRecordInAirtable(user.airtableRecordId, serializeUserFields(user, false));
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

export function readStoredUsers(): AppUser[] {
  return [];
}

export function readStoredTokens(): PasswordResetToken[] {
  const raw = localStorage.getItem(RESET_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as PasswordResetToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Number.isFinite(entry.expiresAt));
  } catch {
    return [];
  }
}

export function readStoredEmailChangeTokens(): EmailChangeToken[] {
  const raw = localStorage.getItem(EMAIL_CHANGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as EmailChangeToken[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => Number.isFinite(entry.expiresAt) && typeof entry.nextEmail === 'string');
  } catch {
    return [];
  }
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

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sendGoogleEmail(to: string, subject: string, body: string): Promise<boolean> {
  const token = (import.meta.env.VITE_GOOGLE_GMAIL_ACCESS_TOKEN as string | undefined)?.trim();
  if (!token) {
    return false;
  }

  const fromEmail = (import.meta.env.VITE_GOOGLE_GMAIL_FROM_EMAIL as string | undefined)?.trim();
  const mime = [
    ...(fromEmail ? [`From: ${fromEmail}`] : []),
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to send Gmail message (${response.status}): ${detail}`);
  }

  return true;
}

export function openResetEmailDraft(email: string, link: string): void {
  const subject = encodeURIComponent('Password reset request');
  const body = encodeURIComponent(
    [
      'A password reset was requested for your account.',
      '',
      `Use this link to reset your password: ${link}`,
      '',
      'If you did not request this reset, please ignore this email.',
    ].join('\n'),
  );

  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
}

export function openEmailChangeDraft(email: string, link: string): void {
  const subject = encodeURIComponent('Confirm your email change');
  const body = encodeURIComponent(
    [
      'An email change was requested for your account.',
      '',
      `Use this link to confirm your new email address: ${link}`,
      '',
      'If you did not request this change, you can ignore this email.',
    ].join('\n'),
  );

  window.open(`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`, '_blank');
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
    const sent = await sendGoogleEmail(email, subject, body);
    if (sent) {
      return 'gmail';
    }
  } catch {
    // Fall back to a mailto draft when Gmail API is unavailable.
  }

  openWelcomeEmailDraft(email, temporaryPassword);
  return 'draft';
}
