import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const DEFAULT_WORKFLOW_SOURCE = 'Manual Entry';
const APPLY_CONFIRM_TOKEN = 'APPLY_MISSING_USED_GEAR_WORKFLOW_SOURCES';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'missing-used-gear-workflow-sources');
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
  console.log('Fill missing used-gear workflow sources');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--output-dir path]');
  console.log('  apply --plan path/to/cleanup-plan.json --confirm APPLY_MISSING_USED_GEAR_WORKFLOW_SOURCES [--output-dir path]');
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
  return typeof value === 'string' ? value.trim() : '';
}

function buildCleanupPlan(records) {
  return records.flatMap((record) => {
    const fields = record.fields || {};
    const workflowSource = getTrimmedString(fields['Workflow Source']);
    const jotFormSubmissionId = getTrimmedString(fields['JotForm Submission ID']);

    if (workflowSource || jotFormSubmissionId) {
      return [];
    }

    return [{
      id: record.id,
      itemTitle: getTrimmedString(fields['Item Title']) || getTrimmedString(fields['Template Name']),
      workflowStatus: getTrimmedString(fields['Workflow Status']),
      beforeFields: {
        'Workflow Source': fields['Workflow Source'] ?? '',
      },
      afterFields: {
        'Workflow Source': DEFAULT_WORKFLOW_SOURCE,
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
    throw new Error('Cleanup plan must be a JSON object.');
  }

  if (plan.approvedBaseId !== APPROVED_BASE_ID || plan.approvedTableId !== APPROVED_TABLE_ID) {
    throw new Error('Cleanup plan does not target the approved Airtable table.');
  }

  if (plan.defaultWorkflowSource !== DEFAULT_WORKFLOW_SOURCE) {
    throw new Error('Cleanup plan default workflow source does not match the expected value.');
  }

  if (!Array.isArray(plan.entries)) {
    throw new Error('Cleanup plan must include an entries array.');
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

    const currentSource = currentRecord.fields?.['Workflow Source'] ?? '';
    const currentSubmissionId = currentRecord.fields?.['JotForm Submission ID'] ?? '';
    if (currentSource !== entry.beforeFields['Workflow Source'] || getTrimmedString(currentSubmissionId)) {
      drifted.push({
        id: entry.id,
        currentSource,
        currentSubmissionId,
      });
    }
  });

  return drifted;
}

async function runPlan(outputDir) {
  const apiKey = requireApiKey();
  const records = await fetchAllRecords(apiKey);
  const entries = buildCleanupPlan(records);
  const runDir = createRunDirectory('plan', outputDir);
  const summary = {
    generatedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    defaultWorkflowSource: DEFAULT_WORKFLOW_SOURCE,
    totalRows: records.length,
    plannedRecordCount: entries.length,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'cleanup-plan.json'), { ...summary, entries });

  console.log(`Planned workflow-source backfill for ${entries.length} row(s).`);
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
    console.log(`No cleanup entries found in ${resolvedPath}. Nothing to apply.`);
    return;
  }

  const apiKey = requireApiKey();
  const currentRecords = await fetchAllRecords(apiKey);
  const drifted = validateNoDrift(plan.entries, buildCurrentRecordMap(currentRecords));
  if (drifted.length > 0) {
    throw new Error(`Aborting apply because ${drifted.length} planned row(s) drifted since plan generation.`);
  }

  const updates = plan.entries.map((entry) => ({ id: entry.id, fields: entry.afterFields }));
  const updatedRecords = await updateRecords(apiKey, updates);
  const remainingEntries = buildCleanupPlan(await fetchAllRecords(apiKey));
  const runDir = createRunDirectory('apply', outputDir);

  writeJson(path.join(runDir, 'applied-plan.json'), plan);
  writeJson(path.join(runDir, 'updated-records.json'), updatedRecords);
  writeJson(path.join(runDir, 'summary.json'), {
    appliedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    sourcePlanPath: resolvedPath,
    updatedRecordCount: updatedRecords.length,
    remainingMissingSourceCount: remainingEntries.length,
  });

  console.log(`Updated ${updatedRecords.length} workflow row(s).`);
  console.log(`Remaining blank workflow-source row(s): ${remainingEntries.length}`);
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
