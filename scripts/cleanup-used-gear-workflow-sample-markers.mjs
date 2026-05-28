import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const SAMPLE_MARKER = '[WORKFLOW_QUEUE_SAMPLE_DATA]';
const APPLY_CONFIRM_TOKEN = 'APPLY_WORKFLOW_SAMPLE_MARKER_CLEANUP';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'used-gear-workflow-sample-marker-cleanup');
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
  console.log('Used Gear Workflow sample-marker cleanup helper');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--output-dir path]');
  console.log('    Export a dry-run artifact showing every workflow row and field that would have the legacy sample marker removed.');
  console.log('');
  console.log('  apply --plan path/to/cleanup-plan.json --confirm APPLY_WORKFLOW_SAMPLE_MARKER_CLEANUP [--output-dir path]');
  console.log('    Apply the reviewed cleanup plan after confirming that the source field values have not drifted.');
  console.log('');
  console.log('Environment:');
  console.log('  VITE_AIRTABLE_API_KEY or AIRTABLE_API_KEY is required.');
  console.log('');
  console.log('Safety notes:');
  console.log(`  - Scope is hard-locked to base ${APPROVED_BASE_ID}, table ${APPROVED_TABLE_ID}.`);
  console.log(`  - Only string fields currently containing ${SAMPLE_MARKER} are touched.`);
  console.log('  - Apply aborts if a planned field value changed after the plan was generated.');
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

async function fetchAllWorkflowRecords(apiKey) {
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

function sanitizeMarkerText(fieldName, value) {
  if (fieldName === 'Shopify Tags') {
    return value
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token && token !== SAMPLE_MARKER)
      .join(', ');
  }

  return value
    .replaceAll(`${SAMPLE_MARKER} `, '')
    .replaceAll(` ${SAMPLE_MARKER}`, ' ')
    .replaceAll(SAMPLE_MARKER, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+/g, '>')
    .replace(/\s+</g, '<')
    .trim();
}

function buildCleanupPlan(records) {
  const entries = [];

  records.forEach((record) => {
    const fields = record.fields || {};
    const beforeFields = {};
    const afterFields = {};

    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      if (typeof fieldValue !== 'string' || !fieldValue.includes(SAMPLE_MARKER)) {
        return;
      }

      const sanitizedValue = sanitizeMarkerText(fieldName, fieldValue);
      if (sanitizedValue === fieldValue) {
        return;
      }

      beforeFields[fieldName] = fieldValue;
      afterFields[fieldName] = sanitizedValue;
    });

    const changedFieldNames = Object.keys(afterFields);
    if (changedFieldNames.length === 0) {
      return;
    }

    entries.push({
      id: record.id,
      workflowStatus: typeof fields['Workflow Status'] === 'string' ? fields['Workflow Status'] : '',
      itemTitle: typeof fields['Item Title'] === 'string' ? fields['Item Title'] : '',
      changedFieldNames,
      beforeFields,
      afterFields,
    });
  });

  return entries;
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
      body: JSON.stringify({
        typecast: true,
        records: batch,
      }),
    });

    updatedRecords.push(...(payload.records || []));
  }

  return updatedRecords;
}

function buildSummary(records, planEntries) {
  return {
    generatedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    sampleMarker: SAMPLE_MARKER,
    totalRows: records.length,
    plannedRecordCount: planEntries.length,
    plannedFieldCount: planEntries.reduce((count, entry) => count + entry.changedFieldNames.length, 0),
    plannedRecordIds: planEntries.map((entry) => entry.id),
  };
}

async function runPlan(outputDir) {
  const apiKey = requireApiKey();
  const records = await fetchAllWorkflowRecords(apiKey);
  const planEntries = buildCleanupPlan(records);
  const runDir = createRunDirectory('plan', outputDir);
  const summary = buildSummary(records, planEntries);
  const plan = {
    ...summary,
    entries: planEntries,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'cleanup-plan.json'), plan);
  writeJson(
    path.join(runDir, 'matching-records.json'),
    planEntries.map((entry) => ({
      id: entry.id,
      workflowStatus: entry.workflowStatus,
      itemTitle: entry.itemTitle,
      changedFieldNames: entry.changedFieldNames,
      beforeFields: entry.beforeFields,
      afterFields: entry.afterFields,
    })),
  );

  console.log(`Planned cleanup for ${planEntries.length} workflow row(s).`);
  console.log(`Artifacts saved in ${runDir}`);
  console.log(`PLAN_FILE ${path.join(runDir, 'cleanup-plan.json')}`);
}

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('Cleanup plan must be a JSON object.');
  }

  if (plan.approvedBaseId !== APPROVED_BASE_ID || plan.approvedTableId !== APPROVED_TABLE_ID) {
    throw new Error('Cleanup plan does not target the approved workflow Airtable table.');
  }

  if (plan.sampleMarker !== SAMPLE_MARKER) {
    throw new Error('Cleanup plan sample marker does not match the expected legacy marker.');
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

    entry.changedFieldNames.forEach((fieldName) => {
      const currentValue = currentRecord.fields?.[fieldName] ?? null;
      const plannedBeforeValue = entry.beforeFields[fieldName] ?? null;
      if (currentValue !== plannedBeforeValue) {
        drifted.push({
          id: entry.id,
          fieldName,
          plannedBeforeValue,
          currentValue,
        });
      }
    });
  });

  return drifted;
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
  const currentRecords = await fetchAllWorkflowRecords(apiKey);
  const currentRecordMap = buildCurrentRecordMap(currentRecords);
  const drifted = validateNoDrift(plan.entries, currentRecordMap);

  if (drifted.length > 0) {
    throw new Error(`Aborting apply because ${drifted.length} planned field value(s) drifted since plan generation.`);
  }

  const updates = plan.entries.map((entry) => ({
    id: entry.id,
    fields: entry.afterFields,
  }));
  const updatedRecords = await updateRecords(apiKey, updates);
  const remainingPlanEntries = buildCleanupPlan(await fetchAllWorkflowRecords(apiKey));
  const runDir = createRunDirectory('apply', outputDir);

  writeJson(path.join(runDir, 'applied-plan.json'), plan);
  writeJson(path.join(runDir, 'updated-records.json'), updatedRecords);
  writeJson(path.join(runDir, 'summary.json'), {
    appliedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    sourcePlanPath: resolvedPath,
    updatedRecordCount: updatedRecords.length,
    updatedRecordIds: updatedRecords.map((record) => record.id),
    remainingTaggedRecordCount: remainingPlanEntries.length,
    remainingTaggedRecordIds: remainingPlanEntries.map((entry) => entry.id),
  });

  console.log(`Updated ${updatedRecords.length} workflow row(s).`);
  console.log(`Remaining tagged workflow row(s): ${remainingPlanEntries.length}`);
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