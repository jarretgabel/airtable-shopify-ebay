import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const APPROVED_BASE_ID = 'apprsAm2FOohEmL2u';
const APPROVED_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'used-gear-workflow-backfill');
const BATCH_SIZE = 10;

const APPROVED_WORKFLOW_STATUSES = new Set([
  'Pending Review',
  'Unqualified',
  'Accepted - Awaiting Arrival',
  'Accepted - Arrived, Awaiting SKU',
  'Accepted - Arrived, Awaiting Missing Item',
  'Testing In Progress',
  'Photography In Progress',
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
  'Sold - Ready to Ship',
  'Shipped',
]);

const APPROVED_WORKFLOW_SOURCES = new Set(['JotForm', 'Manual Entry']);
const APPROVED_TRASH_STATUSES = new Set(['Active Trash', 'Restored', 'Ready for Deletion']);
const APPROVED_ALLOCATION_MODES = new Set(['Equal Split', 'Manual Override']);

const APPROVED_WRITE_FIELDS = new Set([
  'Workflow Source',
  'Pick Up ID',
  'Trash Status',
  'Accepted By',
  'Accepted At',
  'Processing Signed By',
  'Processing Signed At',
  'Testing Signed By',
  'Testing Signed At',
  'Photography Signed By',
  'Photography Signed At',
  'Pre-Listing Reviewed By',
  'Pre-Listing Reviewed At',
  'Qualification Notes',
  'Qualification Complete',
  'Unqualified Reason',
  'Offer Amount',
  'Paid Amount',
  'Confirmed Grand Total',
  'Allocation Mode',
  'Allocation Notes',
  'Workflow Status',
  'Awaiting Pre-Listing Review At',
  'Approved For Publish At',
  'Listed At',
  'Stale Listing At',
  'Stale Recovery Status',
  'Stale Recovery Notes',
  'Stale Recovery Updated At',
  'Relisted At',
  'Sold Ready To Ship At',
  'Shipped At',
]);

const SNAPSHOT_STATUS_FIELDS = [
  'Workflow Status',
  'Workflow Source',
  'Pick Up ID',
  'Trash Status',
  'Qualification Complete',
  'Unqualified Reason',
  'Accepted At',
  'Processing Signed At',
  'Testing Signed At',
  'Photography Signed At',
  'Pre-Listing Reviewed At',
  'Awaiting Pre-Listing Review At',
  'Approved For Publish At',
  'Listed At',
  'Stale Listing At',
  'Stale Recovery Status',
  'Stale Recovery Notes',
  'Stale Recovery Updated At',
  'Relisted At',
  'Sold Ready To Ship At',
  'Shipped At',
];

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

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function printHelp() {
  console.log('Used Gear Workflow backfill helper');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--output-dir path]');
  console.log('    Export a snapshot and build a reviewed mapping template for the approved used-gear workflow table.');
  console.log('');
  console.log('  apply --mapping path/to/mapping-template.json --confirm APPLY_USED_GEAR_BACKFILL [--output-dir path]');
  console.log('    Apply reviewed backfill updates for rows where `apply` is set to true in the mapping file.');
  console.log('');
  console.log('Environment:');
  console.log('  VITE_AIRTABLE_API_KEY is required.');
  console.log('');
  console.log('Safety notes:');
  console.log(`  - Scope is hard-locked to base ${APPROVED_BASE_ID}, table ${APPROVED_TABLE_ID}.`);
  console.log('  - Only approved workflow fields can be written.');
  console.log('  - The plan command sets `apply: false` for every row; operators must explicitly review and opt rows in before apply.');
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

function getTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickFields(fields, fieldNames) {
  return Object.fromEntries(fieldNames.map((fieldName) => [fieldName, fields[fieldName] ?? null]));
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

function summarizeRecords(records) {
  const byStatus = {};
  let missingWorkflowStatusCount = 0;

  records.forEach((record) => {
    const status = getTrimmedString(record.fields['Workflow Status']);
    if (!status) {
      missingWorkflowStatusCount += 1;
      return;
    }

    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  return {
    totalRows: records.length,
    missingWorkflowStatusCount,
    byStatus,
  };
}

function buildPlanEntry(record) {
  const currentStatus = getTrimmedString(record.fields['Workflow Status']);
  const currentSource = getTrimmedString(record.fields['Workflow Source']);
  const currentTrashStatus = getTrimmedString(record.fields['Trash Status']);
  const proposedFields = {};
  const reviewNotes = [];

  if (APPROVED_WORKFLOW_STATUSES.has(currentStatus)) {
    proposedFields['Workflow Status'] = currentStatus;
  } else if (currentStatus) {
    reviewNotes.push(`Unapproved workflow status requires review: ${currentStatus}`);
  } else {
    reviewNotes.push('Workflow Status is blank and requires manual classification.');
  }

  if (APPROVED_WORKFLOW_SOURCES.has(currentSource)) {
    proposedFields['Workflow Source'] = currentSource;
  } else if (currentSource) {
    reviewNotes.push(`Workflow Source requires review: ${currentSource}`);
  }

  if (currentTrashStatus) {
    if (APPROVED_TRASH_STATUSES.has(currentTrashStatus)) {
      proposedFields['Trash Status'] = currentTrashStatus;
    } else {
      reviewNotes.push(`Trash Status requires review: ${currentTrashStatus}`);
    }
  }

  for (const fieldName of [
    'Pick Up ID',
    'Qualification Complete',
    'Unqualified Reason',
    'Accepted At',
    'Processing Signed At',
    'Testing Signed At',
    'Photography Signed At',
    'Pre-Listing Reviewed At',
    'Awaiting Pre-Listing Review At',
    'Approved For Publish At',
    'Listed At',
    'Stale Listing At',
    'Sold Ready To Ship At',
    'Shipped At',
  ]) {
    if (record.fields[fieldName] !== undefined) {
      proposedFields[fieldName] = record.fields[fieldName];
    }
  }

  if (currentStatus === 'Unqualified' && !currentTrashStatus) {
    reviewNotes.push('Unqualified rows should be reviewed for Trash Status before apply.');
  }

  return {
    recordId: record.id,
    apply: false,
    manualReviewRequired: reviewNotes.length > 0,
    reviewNotes,
    notes: '',
    current: {
      createdTime: record.createdTime,
      fields: pickFields(record.fields, SNAPSHOT_STATUS_FIELDS),
    },
    proposedFields,
  };
}

function validateTimestampField(fieldName, value) {
  if (value === null || value === undefined || value === '') {
    return;
  }

  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${fieldName} must be an ISO-like timestamp string when provided.`);
  }
}

function validateMappingEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('Each mapping entry must be an object.');
  }

  const recordId = getTrimmedString(entry.recordId);
  if (!recordId) {
    throw new Error('Each mapping entry must include a recordId.');
  }

  const proposedFields = entry.proposedFields;
  if (!proposedFields || typeof proposedFields !== 'object' || Array.isArray(proposedFields)) {
    throw new Error(`Mapping entry ${recordId} must include a proposedFields object.`);
  }

  for (const fieldName of Object.keys(proposedFields)) {
    if (!APPROVED_WRITE_FIELDS.has(fieldName)) {
      throw new Error(`Mapping entry ${recordId} includes a non-approved field: ${fieldName}`);
    }
  }

  const workflowStatus = getTrimmedString(proposedFields['Workflow Status']);
  if (workflowStatus && !APPROVED_WORKFLOW_STATUSES.has(workflowStatus)) {
    throw new Error(`Mapping entry ${recordId} includes an unapproved Workflow Status: ${workflowStatus}`);
  }

  const workflowSource = getTrimmedString(proposedFields['Workflow Source']);
  if (workflowSource && !APPROVED_WORKFLOW_SOURCES.has(workflowSource)) {
    throw new Error(`Mapping entry ${recordId} includes an unapproved Workflow Source: ${workflowSource}`);
  }

  const trashStatus = getTrimmedString(proposedFields['Trash Status']);
  if (trashStatus && !APPROVED_TRASH_STATUSES.has(trashStatus)) {
    throw new Error(`Mapping entry ${recordId} includes an unapproved Trash Status: ${trashStatus}`);
  }

  const allocationMode = getTrimmedString(proposedFields['Allocation Mode']);
  if (allocationMode && !APPROVED_ALLOCATION_MODES.has(allocationMode)) {
    throw new Error(`Mapping entry ${recordId} includes an unapproved Allocation Mode: ${allocationMode}`);
  }

  if (
    proposedFields['Qualification Complete'] !== undefined
    && proposedFields['Qualification Complete'] !== null
    && typeof proposedFields['Qualification Complete'] !== 'boolean'
  ) {
    throw new Error(`Mapping entry ${recordId} must use a boolean for Qualification Complete.`);
  }

  for (const fieldName of ['Offer Amount', 'Paid Amount', 'Confirmed Grand Total']) {
    const value = proposedFields[fieldName];
    if (value !== undefined && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Mapping entry ${recordId} must use a finite number for ${fieldName}.`);
    }
  }

  for (const fieldName of [
    'Accepted At',
    'Processing Signed At',
    'Testing Signed At',
    'Photography Signed At',
    'Pre-Listing Reviewed At',
    'Awaiting Pre-Listing Review At',
    'Approved For Publish At',
    'Listed At',
    'Stale Listing At',
    'Sold Ready To Ship At',
    'Shipped At',
  ]) {
    validateTimestampField(fieldName, proposedFields[fieldName]);
  }

  return {
    recordId,
    apply: entry.apply === true,
    manualReviewRequired: entry.manualReviewRequired === true,
    proposedFields,
  };
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function patchRecordBatch(apiKey, updates) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(APPROVED_BASE_ID)}/${encodeURIComponent(APPROVED_TABLE_ID)}`;
  return fetchJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      records: updates.map((update) => ({ id: update.recordId, fields: update.proposedFields })),
      typecast: true,
    }),
  });
}

async function runPlan(outputDir) {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const runDir = createRunDirectory('plan', outputDir);
  const records = await fetchAllWorkflowRecords(apiKey);
  const mappingTemplate = records.map(buildPlanEntry);

  writeJson(path.join(runDir, 'snapshot.json'), records);
  writeJson(path.join(runDir, 'mapping-template.json'), mappingTemplate);
  writeJson(path.join(runDir, 'summary.json'), {
    generatedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    recordSummary: summarizeRecords(records),
    manualReviewCount: mappingTemplate.filter((entry) => entry.manualReviewRequired).length,
  });

  console.log(`Backfill plan created in ${runDir}`);
  console.log('Files:');
  console.log(`  - ${path.join(runDir, 'snapshot.json')}`);
  console.log(`  - ${path.join(runDir, 'mapping-template.json')}`);
  console.log(`  - ${path.join(runDir, 'summary.json')}`);
  console.log('Review the mapping template, set `apply: true` only on rows you approve, and then run the apply command.');
}

async function runApply(mappingPath, confirmToken, outputDir) {
  if (confirmToken !== 'APPLY_USED_GEAR_BACKFILL') {
    throw new Error('Apply mode requires --confirm APPLY_USED_GEAR_BACKFILL.');
  }

  if (!mappingPath) {
    throw new Error('Apply mode requires --mapping path/to/mapping-template.json.');
  }

  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const runDir = createRunDirectory('apply', outputDir);
  const mapping = JSON.parse(fs.readFileSync(path.resolve(mappingPath), 'utf8'));
  if (!Array.isArray(mapping)) {
    throw new Error('Mapping file must contain a JSON array.');
  }

  const validatedEntries = mapping.map(validateMappingEntry);
  const updates = validatedEntries.filter((entry) => entry.apply && Object.keys(entry.proposedFields).length > 0);
  if (updates.length === 0) {
    throw new Error('No reviewed rows were marked with apply: true.');
  }

  const beforeSnapshot = await fetchAllWorkflowRecords(apiKey);
  writeJson(path.join(runDir, 'snapshot-before.json'), beforeSnapshot);

  const updatedRecordIds = [];
  for (const batch of chunk(updates, BATCH_SIZE)) {
    await patchRecordBatch(apiKey, batch);
    updatedRecordIds.push(...batch.map((entry) => entry.recordId));
  }

  const afterSnapshot = await fetchAllWorkflowRecords(apiKey);
  writeJson(path.join(runDir, 'snapshot-after.json'), afterSnapshot);
  writeJson(path.join(runDir, 'apply-report.json'), {
    appliedAt: new Date().toISOString(),
    approvedBaseId: APPROVED_BASE_ID,
    approvedTableId: APPROVED_TABLE_ID,
    mappingPath: path.resolve(mappingPath),
    updatedRecordIds,
    appliedCount: updatedRecordIds.length,
    beforeSummary: summarizeRecords(beforeSnapshot),
    afterSummary: summarizeRecords(afterSnapshot),
  });

  console.log(`Applied ${updatedRecordIds.length} reviewed backfill row(s).`);
  console.log(`Run artifacts saved in ${runDir}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'plan') {
    await runPlan(options['output-dir']);
    return;
  }

  if (command === 'apply') {
    await runApply(options.mapping, options.confirm, options['output-dir']);
    return;
  }

  throw new Error(`Unsupported command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});