import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const APPLY_CONFIRM_TOKEN = 'APPLY_UNIQUE_USED_GEAR_ITEM_TITLES';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'used-gear-item-titles');
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

function getEnv(name) {
  const value = mergedEnv[name]?.trim();
  return value || '';
}

function requireApiKey() {
  const apiKey = getEnv('VITE_AIRTABLE_API_KEY') || getEnv('AIRTABLE_API_KEY');
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY or AIRTABLE_API_KEY');
  }

  return apiKey;
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
  console.log('Backfill unique used-gear item titles');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--output-dir path]');
  console.log(`  apply --plan path/to/backfill-plan.json --confirm ${APPLY_CONFIRM_TOKEN} [--output-dir path]`);
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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `${response.status} ${response.statusText}`);
  }

  return body;
}

async function fetchAllRecords(apiKey) {
  const records = [];
  let offset = '';

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) {
      params.set('offset', offset);
    }

    const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}?${params.toString()}`;
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

function getTrimmedString(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
    return typeof firstString === 'string' ? firstString.trim() : '';
  }

  if (value && typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') {
      return value.text.trim();
    }

    if ('name' in value && typeof value.name === 'string') {
      return value.name.trim();
    }
  }

  return '';
}

function buildShortRecordId(recordId) {
  const trimmedRecordId = getTrimmedString(recordId);
  const normalizedRecordId = trimmedRecordId.replace(/^rec[-_]?/i, '');
  if (!normalizedRecordId) {
    return trimmedRecordId;
  }

  return normalizedRecordId;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeRepeatedPrefix(value, prefix) {
  const trimmedValue = getTrimmedString(value);
  const trimmedPrefix = getTrimmedString(prefix);
  if (!trimmedValue || !trimmedPrefix) {
    return trimmedValue;
  }

  const repeatedPrefixPattern = new RegExp(`^${escapeRegExp(trimmedPrefix)}(?:\\s+|[-/])+`, 'i');
  return trimmedValue.replace(repeatedPrefixPattern, '').trim() || trimmedValue;
}

function buildItemTitle(fields, recordId) {
  const make = getTrimmedString(fields.Make);
  const model = removeRepeatedPrefix(fields.Model, fields.Make);
  const componentType = getTrimmedString(fields['Component Type']);
  const baseTitle = [make, model].filter(Boolean).join(' ')
    || [make, componentType].filter(Boolean).join(' ')
    || [model, componentType].filter(Boolean).join(' ')
    || componentType
    || 'Item';
  const shortRecordId = buildShortRecordId(recordId);

  return shortRecordId ? `${baseTitle} - ${shortRecordId}` : baseTitle;
}

function buildPlanEntries(records) {
  return records.flatMap((record) => {
    const fields = record.fields || {};
    const currentItemTitle = getTrimmedString(fields['Item Title']);
    const nextItemTitle = buildItemTitle(fields, record.id);

    if (currentItemTitle === nextItemTitle) {
      return [];
    }

    return [{
      id: record.id,
      workflowStatus: getTrimmedString(fields['Workflow Status']),
      currentItemTitle,
      nextItemTitle,
      beforeFields: {
        'Item Title': fields['Item Title'] ?? '',
      },
      afterFields: {
        'Item Title': nextItemTitle,
      },
    }];
  });
}

async function updateRecords(apiKey, updates) {
  const updatedRecords = [];

  for (let index = 0; index < updates.length; index += BATCH_SIZE) {
    const batch = updates.slice(index, index + BATCH_SIZE);
    const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}`;
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

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Backfill plan must be a JSON object.');
  }

  if (plan.approvedBaseId !== APPROVED_BASE_ID || plan.approvedTableId !== APPROVED_TABLE_ID) {
    throw new Error('Backfill plan does not target the approved Airtable table.');
  }

  if (!Array.isArray(plan.entries)) {
    throw new Error('Backfill plan must include an entries array.');
  }
}

function buildCurrentRecordMap(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function validateNoDrift(planEntries, currentRecordMap) {
  const drifted = [];

  planEntries.forEach((entry) => {
    const currentRecord = currentRecordMap.get(entry.id);
    if (!currentRecord) {
      drifted.push({ id: entry.id, reason: 'Record no longer exists.' });
      return;
    }

    const currentItemTitle = currentRecord.fields?.['Item Title'] ?? '';
    if (currentItemTitle !== entry.beforeFields['Item Title']) {
      drifted.push({
        id: entry.id,
        currentItemTitle,
      });
    }
  });

  return drifted;
}

async function runPlan(outputDir) {
  const apiKey = requireApiKey();
  const records = await fetchAllRecords(apiKey);
  const entries = buildPlanEntries(records);
  const runDir = createRunDirectory('plan', outputDir);
  const plan = {
    generatedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    entries,
  };

  const planPath = path.join(runDir, 'backfill-plan.json');
  writeJson(planPath, plan);

  console.log(`Fetched ${records.length} records from the used-gear workflow table.`);
  console.log(`Planned ${entries.length} item title updates.`);
  console.log(`Plan written to ${planPath}`);
}

async function runApply(planPath, confirmToken, outputDir) {
  if (confirmToken !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply requires --confirm ${APPLY_CONFIRM_TOKEN}`);
  }

  const apiKey = requireApiKey();
  const { value: plan, resolvedPath } = readJson(planPath);
  validatePlan(plan);

  const currentRecords = await fetchAllRecords(apiKey);
  const drifted = validateNoDrift(plan.entries, buildCurrentRecordMap(currentRecords));
  if (drifted.length > 0) {
    throw new Error(`Plan drift detected for ${drifted.length} record(s). Regenerate the plan before applying.`);
  }

  const updates = plan.entries.map((entry) => ({
    id: entry.id,
    fields: entry.afterFields,
  }));

  const updatedRecords = await updateRecords(apiKey, updates);
  const runDir = createRunDirectory('apply', outputDir);
  const result = {
    appliedAt: new Date().toISOString(),
    planPath: resolvedPath,
    updatedCount: updatedRecords.length,
    updatedRecords: updatedRecords.map((record) => ({
      id: record.id,
      itemTitle: record.fields['Item Title'] ?? '',
    })),
  };

  const resultPath = path.join(runDir, 'apply-result.json');
  writeJson(resultPath, result);

  console.log(`Applied ${updatedRecords.length} item title updates.`);
  console.log(`Apply result written to ${resultPath}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === 'help' || options.help === 'true') {
    printHelp();
    return;
  }

  if (command === 'plan') {
    await runPlan(options['output-dir']);
    return;
  }

  if (command === 'apply') {
    if (!options.plan) {
      throw new Error('apply requires --plan path/to/backfill-plan.json');
    }

    await runApply(options.plan, options.confirm, options['output-dir']);
    return;
  }

  printHelp();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});