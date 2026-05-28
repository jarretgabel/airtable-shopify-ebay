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

const ROLE_ALLOWED_PAGES = {
  admin: [
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
    'ebay',
    'settings',
    'notifications',
    'imagelab',
    'users',
  ],
  owner: [
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
    'ebay',
    'market',
    'settings',
    'notifications',
    'imagelab',
    'users',
  ],
  developer: [
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
    'ebay',
    'market',
    'settings',
    'notifications',
    'imagelab',
    'users',
  ],
  processor: [
    'dashboard',
    'workflow-guide',
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
    'ebay',
    'market',
    'settings',
    'notifications',
    'imagelab',
  ],
  tester: ['dashboard', 'workflow-guide', 'testing-queue', 'testing'],
  photographer: ['dashboard', 'workflow-guide', 'photography-queue', 'photos', 'imagelab'],
};

const WORKFLOW_EVENT_KEYS = [
  'pendingReview',
  'processing',
  'testing',
  'photography',
  'preListingReview',
  'approvedForPublish',
];

const TEAM_USER_DEFINITIONS = [
  {
    id: 'u-andy-collins',
    name: 'Andy Collins',
    email: 'andy@resolutionavnyc.com',
    teams: ['processing', 'testing'],
  },
  {
    id: 'u-david-wang',
    name: 'David Wang',
    email: 'david@ravnyc.com',
    teams: ['processing', 'testing'],
  },
  {
    id: 'u-eduardo-trejo',
    name: 'Eduardo Trejo',
    email: 'eduardo@resolutionavnyc.com',
    teams: ['photography'],
  },
  {
    id: 'u-edward-priesner',
    name: 'Edward Priesner',
    email: 'edward@stereobuyers.com',
    teams: ['admin', 'processing', 'testing', 'photography'],
  },
  {
    id: 'u-kesley-laseur',
    name: 'Kesley LaSeur',
    email: 'kesley@resolutionavnyc.com',
    teams: ['processing'],
  },
  {
    id: 'u-adam-wexler',
    name: 'Adam Wexler',
    email: 'adam@resolutionavnyc.com',
    teams: ['owner'],
  },
  {
    id: 'u-maddy-cook',
    name: 'Maddy Cook',
    email: 'maddy@resolutionavnyc.com',
    teams: ['admin'],
  },
  {
    id: 'u-jarret-gabel',
    name: 'Jarret Gabel',
    email: 'jarretisagabel@gmail.com',
    teams: ['developer'],
  },
  {
    id: 'u-robert-kapszewicz',
    name: 'Robert Kapszewicz',
    email: 'robert@resolutionavny.com',
    teams: ['admin'],
  },
];

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'users-team-seed');
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

const mergedEnv = {
  ...readEnvFile(path.join(process.cwd(), '.env')),
  ...readEnvFile(path.join(process.cwd(), '.env.local')),
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
    const viewId = secondPart.startsWith('viw') ? secondPart : `viw${secondPart}`;

    if (firstPart.startsWith('app')) {
      if (!fallback) {
        throw new Error('Airtable table name is required when reference uses a view ID');
      }
      pushUniqueCandidate({
        baseId: firstPart.startsWith('app') ? firstPart : `app${firstPart}`,
        tableName: fallback,
        viewId,
      });
      return candidates;
    }

    pushUniqueCandidate({
      baseId: defaultBaseId,
      tableName: secondPart.startsWith('tbl') ? secondPart : `tbl${firstPart}`,
      viewId,
    });

    if (fallback) {
      pushUniqueCandidate({
        baseId: firstPart.startsWith('app') ? firstPart : `app${firstPart}`,
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
    baseId: firstPart.startsWith('app') ? firstPart : `app${firstPart}`,
    tableName: secondPart.startsWith('tbl') ? secondPart : `tbl${secondPart}`,
  });

  return candidates;
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
      return await fetchJson(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: writableFields, typecast: true }),
      });
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to create seeded user after removing unsupported fields.');
}

async function updateUserRecord(baseId, tableName, recordId, fields) {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const writableFields = { ...fields };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await fetchJson(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields: writableFields, typecast: true }),
      });
    } catch (error) {
      const unknownField = getUnknownFieldName(error);
      if (!unknownField || !(unknownField in writableFields)) {
        throw error;
      }
      delete writableFields[unknownField];
    }
  }

  throw new Error('Failed to update seeded user after removing unsupported fields.');
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirectory(prefix) {
  ensureDirectory(RUNS_DIR);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${prefix}-${stamp}`);
  ensureDirectory(runDir);
  return runDir;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function randomFrom(source) {
  return source[randomBytes(1)[0] % source.length];
}

function generateTemporaryPassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  const pool = upper + lower + digits + symbols;
  const chars = [
    randomFrom(upper),
    randomFrom(lower),
    randomFrom(digits),
    randomFrom(symbols),
    ...Array.from({ length: Math.max(0, length - 4) }, () => randomFrom(pool)),
  ];

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars.join('');
}

function parseMode(argv) {
  const mode = argv[0] || 'list';
  if (!['list', 'seed'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}. Use "list" or "seed".`);
  }
  return mode;
}

function printHelp() {
  console.log('Usage:');
  console.log('  npm run users:actual-users:list');
  console.log('  npm run users:actual-users:seed');
  console.log('');
  console.log('This script seeds the hard-coded live internal user roster into the Airtable Users table.');
  console.log('List mode previews the live-user seed set without changing Airtable.');
  console.log('Seed mode creates or updates those live users, generates temporary passwords when needed, and never sends welcome emails.');
}

function getPrimaryRole(teams) {
  if (teams.includes('owner')) return 'owner';
  if (teams.includes('admin')) return 'admin';
  if (teams.includes('developer')) return 'developer';
  if (teams.includes('processing')) return 'processor';
  if (teams.includes('testing')) return 'tester';
  return 'photographer';
}

function createNotificationPreferences(teams, role) {
  const workflowEvents = Object.fromEntries(WORKFLOW_EVENT_KEYS.map((key) => [key, false]));

  if (role === 'admin' || role === 'owner') {
    WORKFLOW_EVENT_KEYS.forEach((key) => {
      workflowEvents[key] = true;
    });
  } else if (role !== 'developer') {
    if (teams.includes('processing')) {
      workflowEvents.pendingReview = true;
      workflowEvents.processing = true;
      workflowEvents.preListingReview = true;
      workflowEvents.approvedForPublish = true;
    }
    if (teams.includes('testing')) {
      workflowEvents.testing = true;
    }
    if (teams.includes('photography')) {
      workflowEvents.photography = true;
    }
  }

  return {
    infoEnabled: true,
    successEnabled: true,
    warningEnabled: true,
    errorEnabled: true,
    autoDismissMs: 5000,
    workflowAssignedAlertsEnabled: true,
    workflowUnassignedAlertsEnabled: true,
    workflowEvents,
  };
}

function buildDesiredUserRecord(definition) {
  const role = getPrimaryRole(definition.teams);
  return {
    ...definition,
    role,
    allowedPages: [...ROLE_ALLOWED_PAGES[role]],
    notifications: createNotificationPreferences(definition.teams, role),
  };
}

function buildFields(desired, options) {
  const fields = {
    [USER_FIELD_KEYS.id[0]]: desired.id,
    [USER_FIELD_KEYS.name[0]]: desired.name,
    [USER_FIELD_KEYS.email[0]]: desired.email,
    [USER_FIELD_KEYS.role[0]]: desired.role,
    [USER_FIELD_KEYS.mustChangePassword[0]]: options.mustChangePassword,
    [USER_FIELD_KEYS.allowedPages[0]]: desired.allowedPages.join(','),
    [USER_FIELD_KEYS.notifications[0]]: JSON.stringify(desired.notifications),
    [USER_FIELD_KEYS.updatedAt[0]]: options.updatedAt,
  };

  if (options.password) {
    fields[USER_FIELD_KEYS.password[0]] = serializePasswordField(options.password, options.mustChangePassword);
  }

  if (options.includeCreatedAt) {
    fields[USER_FIELD_KEYS.createdAt[0]] = options.updatedAt;
  }

  return fields;
}

function planSeed(records) {
  const recordsByEmail = new Map(records.map((record) => [normalizeEmail(toSingleString(getFieldValue(record.fields, USER_FIELD_KEYS.email))), record]));
  const today = toDateStamp();

  return TEAM_USER_DEFINITIONS.map((definition) => {
    const desired = buildDesiredUserRecord({
      ...definition,
      email: normalizeEmail(definition.email),
    });
    const existingRecord = recordsByEmail.get(desired.email) ?? null;
    const existingPassword = existingRecord ? toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.password)) : '';
    const existingMustChangePassword = existingRecord ? parseBoolean(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.mustChangePassword)) : false;
    const needsGeneratedPassword = !existingRecord || !existingPassword;
    const generatedPassword = needsGeneratedPassword ? generateTemporaryPassword() : '';
    const mustChangePassword = needsGeneratedPassword ? true : existingMustChangePassword;
    const nextFields = buildFields(desired, {
      password: generatedPassword,
      mustChangePassword,
      updatedAt: today,
      includeCreatedAt: !existingRecord,
    });

    const currentFields = existingRecord ? {
      name: toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.name)),
      role: toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.role)).toLowerCase(),
      allowedPages: toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.allowedPages)),
      notifications: toSingleString(getFieldValue(existingRecord.fields, USER_FIELD_KEYS.notifications)),
      mustChangePassword: existingMustChangePassword,
      hasPassword: Boolean(existingPassword),
    } : null;
    const nextComparableFields = {
      name: desired.name,
      role: desired.role,
      allowedPages: desired.allowedPages.join(','),
      notifications: JSON.stringify(desired.notifications),
      mustChangePassword,
      hasPassword: needsGeneratedPassword ? true : Boolean(existingPassword),
    };
    const changed = !currentFields || Object.entries(nextComparableFields).some(([key, value]) => currentFields[key] !== value);

    return {
      desired,
      existingRecord,
      fields: nextFields,
      generatedPassword,
      status: !existingRecord ? 'create' : changed ? 'update' : 'unchanged',
      reason: !existingRecord
        ? 'missing user record'
        : !existingPassword
          ? 'existing record missing password'
          : changed
            ? 'name, role, access, or notifications differ'
            : 'already matches seed definition',
    };
  });
}

function printPlan(plans) {
  console.log('Live internal user seed preview:');
  console.log('');
  plans.forEach((plan) => {
    console.log(`${plan.status.toUpperCase()} ${plan.desired.email}`);
    console.log(`  Name: ${plan.desired.name}`);
    console.log(`  Role: ${plan.desired.role}`);
    console.log(`  Teams: ${plan.desired.teams.join(', ')}`);
    console.log(`  Reason: ${plan.reason}`);
    if (plan.generatedPassword) {
      console.log('  Password: will be auto-generated on seed');
    }
  });
}

async function applyPlan(baseId, tableName, plans) {
  const results = [];

  for (const plan of plans) {
    if (plan.status === 'unchanged') {
      results.push({
        email: plan.desired.email,
        name: plan.desired.name,
        status: 'unchanged',
        role: plan.desired.role,
        teams: plan.desired.teams,
      });
      continue;
    }

    const response = plan.existingRecord
      ? await updateUserRecord(baseId, tableName, plan.existingRecord.id, plan.fields)
      : await createUserRecord(baseId, tableName, plan.fields);

    results.push({
      email: plan.desired.email,
      name: plan.desired.name,
      status: plan.status,
      role: plan.desired.role,
      teams: plan.desired.teams,
      recordId: response.id,
      temporaryPassword: plan.generatedPassword || undefined,
      mustChangePassword: plan.fields[USER_FIELD_KEYS.mustChangePassword[0]],
    });
  }

  return results;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const mode = parseMode(argv);
  const { baseId, tableName, records } = await fetchUsersTable();
  const plans = planSeed(records);
  const runDir = createRunDirectory(mode);

  writeJson(path.join(runDir, 'plan.json'), plans.map((plan) => ({
    email: plan.desired.email,
    name: plan.desired.name,
    role: plan.desired.role,
    teams: plan.desired.teams,
    status: plan.status,
    reason: plan.reason,
    willGeneratePassword: Boolean(plan.generatedPassword),
  })));

  printPlan(plans);

  if (mode === 'list') {
    console.log('');
    console.log(`Preview only. Saved plan to ${path.relative(process.cwd(), runDir)}/plan.json`);
    return;
  }

  const results = await applyPlan(baseId, tableName, plans);
  writeJson(path.join(runDir, 'results.json'), results);

  const generatedPasswords = results.filter((result) => result.temporaryPassword);
  if (generatedPasswords.length > 0) {
    writeJson(path.join(runDir, 'temporary-passwords.json'), generatedPasswords.map((result) => ({
      email: result.email,
      name: result.name,
      temporaryPassword: result.temporaryPassword,
    })));
  }

  console.log('');
  console.log('Seed applied without sending emails.');
  console.log(`Saved results to ${path.relative(process.cwd(), runDir)}/results.json`);
  if (generatedPasswords.length > 0) {
    console.log('Temporary passwords generated for:');
    generatedPasswords.forEach((result) => {
      console.log(`  ${result.email}: ${result.temporaryPassword}`);
    });
    console.log(`Password file: ${path.relative(process.cwd(), path.join(runDir, 'temporary-passwords.json'))}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});