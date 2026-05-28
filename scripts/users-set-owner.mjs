import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

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
};

const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'workflow-guide-editor',
  'manual-intake',
  'create-intake-item',
  'jotform',
  'jotform-audit',
  'parking-lot-1',
  'trash-review',
  'inventory',
  'testing-queue',
  'photography-queue',
  'testing',
  'photos',
  'listings',
  'post-publish',
  'archive',
  'shopify',
  'market',
  'settings',
  'notifications',
  'imagelab',
  'ebay',
  'users',
];

const OWNER_NOTIFICATION_PREFERENCES = {
  infoEnabled: true,
  successEnabled: true,
  warningEnabled: true,
  errorEnabled: true,
  autoDismissMs: 5000,
  workflowEvents: {
    pendingReview: true,
    processing: true,
    testing: true,
    photography: true,
    preListingReview: true,
    approvedForPublish: true,
  },
};

const PASSWORD_FIELD_PAYLOAD_PREFIX = '__LCC_PASSWORD__:';
const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_KEY_LENGTH = 32;

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const cwd = process.cwd();
const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function getOptionalEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function requireEnv(name) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function toDateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toSingleString(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === 'string');
    return firstString?.trim() ?? '';
  }

  return '';
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
}

function normalizeFieldName(value) {
  return value.trim().toLowerCase();
}

function getFieldValue(fields, candidates) {
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

function normalizeId(raw, prefix) {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

function parseAirtableReferenceCandidates(reference, fallbackTableName, defaultBaseId) {
  const trimmed = reference.trim();
  if (!trimmed) {
    throw new Error('Airtable table reference is empty');
  }

  const cleaned = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^airtable\.com\//, '')
    .replace(/^www\.airtable\.com\//, '')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);

  if (parts.length < 2) {
    throw new Error('Airtable table reference must be in the format "baseId/tableId" or "baseId/viewId"');
  }

  const firstPart = parts[0];
  const secondPart = parts[1];
  const candidates = [];
  const fallback = fallbackTableName?.trim();

  const pushUniqueCandidate = (candidate) => {
    if (candidates.some((current) => current.baseId === candidate.baseId && current.tableName === candidate.tableName && current.viewId === candidate.viewId)) {
      return;
    }
    candidates.push(candidate);
  };

  const secondLooksLikeView = secondPart.startsWith('viw') || !secondPart.startsWith('tbl');

  if (secondLooksLikeView) {
    const viewId = normalizeId(secondPart, 'viw');

    if (firstPart.startsWith('app')) {
      if (!fallback) {
        throw new Error('Airtable table name is required when reference uses a view ID');
      }
      pushUniqueCandidate({
        baseId: normalizeId(firstPart, 'app'),
        tableName: fallback,
        viewId,
      });
      return candidates;
    }

    pushUniqueCandidate({
      baseId: defaultBaseId,
      tableName: normalizeId(firstPart, 'tbl'),
      viewId,
    });

    if (fallback) {
      pushUniqueCandidate({
        baseId: normalizeId(firstPart, 'app'),
        tableName: fallback,
        viewId,
      });
      pushUniqueCandidate({
        baseId: defaultBaseId,
        tableName: fallback,
        viewId,
      });
    }

    return candidates;
  }

  pushUniqueCandidate({
    baseId: normalizeId(firstPart, 'app'),
    tableName: normalizeId(secondPart, 'tbl'),
  });

  return candidates;
}

function encodeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function serializePasswordField(password, mustChangePassword) {
  const salt = randomBytes(16).toString('base64');
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, 'sha256').toString('base64');

  return encodeBase64(`${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({
    scheme: PASSWORD_HASH_SCHEME,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
    hash,
    mustChangePassword,
  })}`);
}

function getUnknownFieldName(error) {
  const status = error?.status ?? error?.statusCode;
  if (status !== 422) {
    return undefined;
  }

  const message = error?.message ?? '';
  const match = message.match(/Unknown field name:\s*"([^"]+)"/i);
  return match?.[1];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(body?.error?.message || body?.message || `${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return body;
}

function resolveUsersTableCandidates() {
  const defaultBaseId = requireEnv('VITE_AIRTABLE_BASE_ID');
  const usersRef = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  const usersName = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') || 'j2Gt9USORo6Vi5';

  if (usersRef && !usersRef.includes('/')) {
    return [{ baseId: defaultBaseId, tableName: usersRef }];
  }

  if (usersRef) {
    return parseAirtableReferenceCandidates(usersRef, usersName, defaultBaseId);
  }

  return [{ baseId: defaultBaseId, tableName: usersName }];
}

async function fetchAllAirtableRecords(baseId, tableName, viewId = '') {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const records = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    if (viewId) url.searchParams.set('view', viewId);
    if (offset) url.searchParams.set('offset', offset);

    const body = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    records.push(...(body.records || []));
    offset = body.offset || '';
  } while (offset);

  return records;
}

async function fetchUsersTable() {
  const candidates = resolveUsersTableCandidates();
  let lastError;

  for (const candidate of candidates) {
    try {
      const records = await fetchAllAirtableRecords(candidate.baseId, candidate.tableName, candidate.viewId || '');
      return { ...candidate, records };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to load the configured Airtable users table.');
}

async function createUserRecord(baseId, tableName, fields) {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const body = await fetchJson(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: writableFields, typecast: true }),
      });
      return body;
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to create owner after removing unsupported fields.');
}

async function updateUserRecord(baseId, tableName, recordId, fields) {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const body = await fetchJson(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: writableFields, typecast: true }),
      });
      return body;
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to update owner after removing unsupported fields.');
}

function parseArgs(argv) {
  const options = {
    email: '',
    name: '',
    password: '',
    mustChangePassword: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help' || value === '-h') {
      options.help = true;
      continue;
    }
    if (value === '--must-change-password') {
      options.mustChangePassword = true;
      continue;
    }
    if (value === '--email') {
      options.email = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (value === '--name') {
      options.name = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (value === '--password') {
      options.password = argv[index + 1] ?? '';
      index += 1;
    }
  }

  return options;
}

function printHelp() {
  console.log('Usage: npm run users:owner-account -- --email owner@example.com --name "Owner Name" --password "StrongPass123!" [--must-change-password]');
  console.log('');
  console.log('This script manages a single owner account record. It does not seed the live team-user roster.');
  console.log('If the email already exists, the script promotes that account to owner and optionally updates name/password.');
  console.log('If the email does not exist, the script creates a new owner record in Airtable.');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const email = normalizeEmail(options.email);
  if (!email) {
    throw new Error('The --email argument is required.');
  }

  const { baseId, tableName, records } = await fetchUsersTable();
  const existingRecord = records.find((record) => normalizeEmail(toSingleString(getFieldValue(record.fields, USER_FIELD_KEYS.email))) === email);
  const existingName = existingRecord ? toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.name)) : '';
  const nextName = options.name.trim() || existingName;

  if (!existingRecord && !nextName) {
    throw new Error('The --name argument is required when creating a new owner account.');
  }

  if (!existingRecord && !options.password.trim()) {
    throw new Error('The --password argument is required when creating a new owner account.');
  }

  const mustChangePassword = options.mustChangePassword || (existingRecord ? parseBoolean(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.mustChangePassword)) : false);
  const userId = existingRecord
    ? toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.id)) || `u-owner-${randomBytes(4).toString('hex')}`
    : `u-owner-${randomBytes(4).toString('hex')}`;
  const today = toDateStamp();

  const fields = {
    [USER_FIELD_KEYS.id[0]]: userId,
    [USER_FIELD_KEYS.name[0]]: nextName,
    [USER_FIELD_KEYS.email[0]]: email,
    [USER_FIELD_KEYS.role[0]]: 'owner',
    [USER_FIELD_KEYS.mustChangePassword[0]]: mustChangePassword,
    [USER_FIELD_KEYS.allowedPages[0]]: APP_PAGES.join(','),
    [USER_FIELD_KEYS.notifications[0]]: JSON.stringify(OWNER_NOTIFICATION_PREFERENCES),
    [USER_FIELD_KEYS.updatedAt[0]]: today,
  };

  if (options.password.trim()) {
    fields[USER_FIELD_KEYS.password[0]] = serializePasswordField(options.password.trim(), mustChangePassword);
  }

  let result;
  if (existingRecord) {
    result = await updateUserRecord(baseId, tableName, existingRecord.id, fields);
    console.log(`Updated owner account for ${email}.`);
  } else {
    fields[USER_FIELD_KEYS.createdAt[0]] = today;
    result = await createUserRecord(baseId, tableName, fields);
    console.log(`Created owner account for ${email}.`);
  }

  console.log(`Record ID: ${result.id}`);
  console.log(`User ID: ${userId}`);
  console.log(`Role: owner`);
  console.log(`Must change password: ${mustChangePassword ? 'yes' : 'no'}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});