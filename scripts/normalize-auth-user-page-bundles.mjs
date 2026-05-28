import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const USER_FIELD_KEYS = {
  id: ['User Id', 'User ID', 'ID'],
  email: ['Email'],
  role: ['Role'],
  allowedPages: ['Allowed Pages', 'AllowedPages'],
};

const APP_PAGES = [
  'dashboard',
  'workflow-guide',
  'workflow-guide-editor',
  'manual-intake',
  'create-intake-item',
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
  'jotform',
  'jotform-audit',
  'market',
  'settings',
  'notifications',
  'imagelab',
  'users',
];

const ROLE_ALLOWED_PAGES = {
  admin: APP_PAGES.filter((page) => page !== 'market'),
  owner: [...APP_PAGES],
  developer: [...APP_PAGES],
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

const ROLE_DEFAULTS_RECORD_PREFIX = '__role-defaults__:';
const APPLY_CONFIRM_TOKEN = 'APPLY_NORMALIZE_AUTH_USER_PAGE_BUNDLES';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'normalize-auth-user-page-bundles');
const BATCH_SIZE = 10;

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

function requireApiKey() {
  const apiKey = getOptionalEnv('VITE_AIRTABLE_API_KEY') || getOptionalEnv('AIRTABLE_API_KEY');
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY or AIRTABLE_API_KEY');
  }
  return apiKey;
}

function requireBaseId() {
  const baseId = getOptionalEnv('VITE_AIRTABLE_BASE_ID');
  if (!baseId) {
    throw new Error('Missing VITE_AIRTABLE_BASE_ID');
  }
  return baseId;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirectory(prefix, providedOutputDir) {
  if (providedOutputDir) {
    ensureDirectory(providedOutputDir);
    return path.resolve(providedOutputDir);
  }

  ensureDirectory(RUNS_DIR);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${prefix}-${stamp}`);
  ensureDirectory(runDir);
  return runDir;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Plan file not found: ${resolvedPath}`);
  }

  return {
    resolvedPath,
    value: JSON.parse(fs.readFileSync(resolvedPath, 'utf8')),
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = rest[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = nextValue;
    index += 1;
  }

  return { command, options };
}

function printHelp() {
  console.log('Normalize auth user page bundles');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--output-dir path]');
  console.log('  apply --plan path/to/cleanup-plan.json --confirm APPLY_NORMALIZE_AUTH_USER_PAGE_BUNDLES [--output-dir path]');
}

function normalizeId(raw, prefix) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
}

function parseAirtableReferenceCandidates(reference, fallbackTableName, defaultBaseId) {
  const trimmed = reference.trim();
  if (!trimmed) {
    return [{ baseId: defaultBaseId, tableName: fallbackTableName }];
  }

  if (!trimmed.includes('/')) {
    return [{ baseId: defaultBaseId, tableName: trimmed }];
  }

  const cleaned = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^airtable\.com\//, '')
    .replace(/^www\.airtable\.com\//, '')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Airtable users table reference must be in the format "baseId/tableId" or "baseId/viewId".');
  }

  const [firstPart, secondPart] = parts;
  const secondLooksLikeView = secondPart.startsWith('viw') || !secondPart.startsWith('tbl');

  if (secondLooksLikeView) {
    const viewId = normalizeId(secondPart, 'viw');
    if (firstPart.startsWith('app')) {
      return [{ baseId: normalizeId(firstPart, 'app'), tableName: fallbackTableName, viewId }];
    }

    return [{ baseId: defaultBaseId, tableName: normalizeId(firstPart, 'tbl'), viewId }];
  }

  return [{ baseId: normalizeId(firstPart, 'app'), tableName: normalizeId(secondPart, 'tbl') }];
}

function resolveUsersTableCandidates() {
  const defaultBaseId = requireBaseId();
  const usersRef = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_REF');
  const usersName = getOptionalEnv('VITE_AIRTABLE_USERS_TABLE_NAME') || 'j2Gt9USORo6Vi5';
  return parseAirtableReferenceCandidates(usersRef, usersName, defaultBaseId);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `${response.status} ${response.statusText}`);
  }

  return body;
}

async function fetchAllRecords(apiKey, candidate) {
  const records = [];
  let offset = '';

  do {
    const url = new URL(`https://api.airtable.com/v0/${candidate.baseId}/${encodeURIComponent(candidate.tableName)}`);
    if (candidate.viewId) {
      url.searchParams.set('view', candidate.viewId);
    }
    if (offset) {
      url.searchParams.set('offset', offset);
    }

    const payload = await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    records.push(...(payload.records || []));
    offset = payload.offset || '';
  } while (offset);

  return records;
}

function normalizeFieldName(value) {
  return String(value || '').trim().toLowerCase();
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

function toSingleString(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === 'string');
    return firstString?.trim() ?? '';
  }
  return '';
}

function parseStoredRole(value) {
  const normalized = toSingleString(value).toLowerCase();
  return Object.hasOwn(ROLE_ALLOWED_PAGES, normalized) ? normalized : '';
}

function parseAllowedPagesValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return toSingleString(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildCurrentRecordMap(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function buildPlan(records) {
  const entries = [];
  const skippedUnknownRoles = [];

  records.forEach((record) => {
    const fields = record.fields || {};
    const userId = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.id)) || record.id;
    if (userId.startsWith(ROLE_DEFAULTS_RECORD_PREFIX)) {
      return;
    }

    const email = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.email)).toLowerCase();
    if (!email) {
      return;
    }

    const rawRole = toSingleString(getFieldValue(fields, USER_FIELD_KEYS.role));
    const parsedRole = parseStoredRole(rawRole);
    if (!parsedRole) {
      skippedUnknownRoles.push({ email, role: rawRole || '(blank)' });
      return;
    }

    const currentAllowedPages = parseAllowedPagesValue(getFieldValue(fields, USER_FIELD_KEYS.allowedPages));
    const desiredAllowedPages = ROLE_ALLOWED_PAGES[parsedRole];
    const currentAllowedPagesValue = currentAllowedPages.join(',');
    const desiredAllowedPagesValue = desiredAllowedPages.join(',');

    if (currentAllowedPagesValue === desiredAllowedPagesValue) {
      return;
    }

    entries.push({
      id: record.id,
      email,
      role: parsedRole,
      beforeFields: {
        'Allowed Pages': currentAllowedPagesValue,
      },
      afterFields: {
        'Allowed Pages': desiredAllowedPagesValue,
      },
      currentAllowedPages,
      desiredAllowedPages,
    });
  });

  return { entries, skippedUnknownRoles };
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Plan file must be a JSON object.');
  }

  if (!Array.isArray(plan.entries)) {
    throw new Error('Plan file must include an entries array.');
  }

  if (!Array.isArray(plan.appPages)) {
    throw new Error('Plan file must include the expected appPages array.');
  }
}

function validateNoDrift(planEntries, currentRecordMap) {
  const drifted = [];

  planEntries.forEach((entry) => {
    const currentRecord = currentRecordMap.get(entry.id);
    if (!currentRecord) {
      drifted.push({ id: entry.id, reason: 'Record no longer exists.' });
      return;
    }

    const fields = currentRecord.fields || {};
    const currentAllowedPagesValue = parseAllowedPagesValue(getFieldValue(fields, USER_FIELD_KEYS.allowedPages)).join(',');
    const currentRole = parseStoredRole(getFieldValue(fields, USER_FIELD_KEYS.role));
    if (currentAllowedPagesValue !== entry.beforeFields['Allowed Pages'] || currentRole !== entry.role) {
      drifted.push({
        id: entry.id,
        email: entry.email,
        currentRole,
        currentAllowedPagesValue,
      });
    }
  });

  return drifted;
}

async function updateRecords(apiKey, candidate, updates) {
  const updatedRecords = [];

  for (let index = 0; index < updates.length; index += BATCH_SIZE) {
    const batch = updates.slice(index, index + BATCH_SIZE);
    const url = `https://api.airtable.com/v0/${candidate.baseId}/${encodeURIComponent(candidate.tableName)}`;
    const payload = await fetchJson(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ typecast: true, records: batch }),
    });

    updatedRecords.push(...(payload.records || []));
  }

  return updatedRecords;
}

async function runPlan(outputDir) {
  const apiKey = requireApiKey();
  const [candidate] = resolveUsersTableCandidates();
  const records = await fetchAllRecords(apiKey, candidate);
  const { entries, skippedUnknownRoles } = buildPlan(records);
  const runDir = createRunDirectory('plan', outputDir);
  const summary = {
    generatedAt: new Date().toISOString(),
    baseId: candidate.baseId,
    tableName: candidate.tableName,
    viewId: candidate.viewId || '',
    totalRows: records.length,
    plannedRecordCount: entries.length,
    skippedUnknownRoleCount: skippedUnknownRoles.length,
    appPages: APP_PAGES,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'cleanup-plan.json'), { ...summary, entries, skippedUnknownRoles });

  console.log(`Planned auth page-bundle normalization for ${entries.length} user row(s).`);
  if (skippedUnknownRoles.length > 0) {
    console.log(`Skipped ${skippedUnknownRoles.length} row(s) with unknown roles.`);
  }
  console.log(`Artifacts saved in ${runDir}`);
  console.log(`PLAN_FILE ${path.join(runDir, 'cleanup-plan.json')}`);
}

async function runApply(planPath, confirmToken, outputDir) {
  if (confirmToken !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  if (!planPath) {
    throw new Error('Apply mode requires --plan path/to/cleanup-plan.json.');
  }

  const { resolvedPath, value: plan } = readJson(planPath);
  validatePlan(plan);

  if (plan.entries.length === 0) {
    console.log(`No auth user page-bundle updates found in ${resolvedPath}. Nothing to apply.`);
    return;
  }

  const apiKey = requireApiKey();
  const [candidate] = resolveUsersTableCandidates();
  const currentRecords = await fetchAllRecords(apiKey, candidate);
  const drifted = validateNoDrift(plan.entries, buildCurrentRecordMap(currentRecords));
  if (drifted.length > 0) {
    throw new Error(`Aborting apply because ${drifted.length} planned user row(s) drifted since plan generation.`);
  }

  const updates = plan.entries.map((entry) => ({ id: entry.id, fields: entry.afterFields }));
  const updatedRecords = await updateRecords(apiKey, candidate, updates);
  const { entries: remainingEntries } = buildPlan(await fetchAllRecords(apiKey, candidate));
  const runDir = createRunDirectory('apply', outputDir);

  writeJson(path.join(runDir, 'applied-plan.json'), plan);
  writeJson(path.join(runDir, 'updated-records.json'), updatedRecords);
  writeJson(path.join(runDir, 'summary.json'), {
    appliedAt: new Date().toISOString(),
    sourcePlanPath: resolvedPath,
    baseId: candidate.baseId,
    tableName: candidate.tableName,
    viewId: candidate.viewId || '',
    updatedRecordCount: updatedRecords.length,
    remainingOutOfSyncCount: remainingEntries.length,
  });

  console.log(`Updated ${updatedRecords.length} auth user row(s).`);
  console.log(`Remaining out-of-sync auth user row(s): ${remainingEntries.length}`);
  console.log(`Artifacts saved in ${runDir}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'plan':
      await runPlan(options['output-dir']);
      return;
    case 'apply':
      await runApply(options.plan || '', options.confirm || '', options['output-dir']);
      return;
    case 'help':
    default:
      printHelp();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});