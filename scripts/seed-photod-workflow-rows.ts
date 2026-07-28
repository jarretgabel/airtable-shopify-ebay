import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

import {
  createRecord,
  getRecords,
  getTableMetadata,
  updateRecord,
  type AirtableMetadataField,
  type AirtableRecord,
} from '../aws/src/providers/airtable/client.ts';

const SOURCE_BASE_ID = 'appjQj8FQfFZ2ogMz';
const SOURCE_TABLE_ID = 'tblirsoRIFPDMHxb0';
const SOURCE_VIEW_ID = 'viwaPByxQY4QBJS3K';

const DEST_BASE_ID = 'apprsAm2FOohEmL2u';
const DEST_TABLE_ID = 'tbl0K0nFQL64jQMx8';

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'photod-workflow-seed');
const APPLY_CONFIRM_TOKEN = 'SEED_PHOTOD_WORKFLOW_ROWS';
const UNSEED_CONFIRM_TOKEN = 'UNSEED_PHOTOD_WORKFLOW_ROWS';
const BATCH_SIZE = 10;

const WORKFLOW_STATUSES = [
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
] as const;

const DEFAULT_TARGET_STAGE = 'Photography In Progress';

const STAGE_ALIASES: Record<string, string> = {
  pending: 'Pending Review',
  'pending review': 'Pending Review',
  unqualified: 'Unqualified',
  'awaiting arrival': 'Accepted - Awaiting Arrival',
  'accepted awaiting arrival': 'Accepted - Awaiting Arrival',
  'awaiting sku': 'Accepted - Arrived, Awaiting SKU',
  'arrived awaiting sku': 'Accepted - Arrived, Awaiting SKU',
  'awaiting missing item': 'Accepted - Arrived, Awaiting Missing Item',
  testing: 'Testing In Progress',
  'testing in progress': 'Testing In Progress',
  photography: 'Photography In Progress',
  'photo ready': 'Photography In Progress',
  'photography in progress': 'Photography In Progress',
  'pre-listing': 'Awaiting Pre-Listing Review',
  'pre listing': 'Awaiting Pre-Listing Review',
  'awaiting pre-listing review': 'Awaiting Pre-Listing Review',
  'listing approval': 'Approved for Publish',
  approval: 'Approved for Publish',
  'approved for publish': 'Approved for Publish',
  'listed shopify': 'Listed, Shopify',
  'listed, shopify': 'Listed, Shopify',
  'listed ebay': 'Listed, eBay',
  'listed, ebay': 'Listed, eBay',
  'stale shopify': 'Stale Listing, Shopify',
  'stale listing shopify': 'Stale Listing, Shopify',
  'stale ebay': 'Stale Listing, eBay',
  'stale listing ebay': 'Stale Listing, eBay',
  sold: 'Sold - Ready to Ship',
  'sold ready': 'Sold - Ready to Ship',
  'sold - ready to ship': 'Sold - Ready to Ship',
  shipped: 'Shipped',
};

const NON_WRITABLE_FIELD_TYPES = new Set([
  'autoNumber',
  'button',
  'count',
  'createdBy',
  'createdTime',
  'formula',
  'lastModifiedBy',
  'lastModifiedTime',
  'multipleLookupValues',
  'rollup',
]);

const MANAGED_FIELD_NAMES = new Set([
  'JotForm Submission ID',
  'Workflow Status',
  'Workflow Source',
  'Pick Up ID',
]);

const SOURCE_STATUS_FIELDS = [
  'Workflow Status',
  'Status',
  'SB Inventory Status',
  'Inventory Status',
];

const SOURCE_PICKUP_FIELDS = [
  'Pick Up ID',
  'Pickup ID',
  'PickUp ID',
  'Group ID',
];

const SOURCE_WORKFLOW_SOURCE_FIELDS = ['Workflow Source', 'Source'];
const SOURCE_SKU_FIELDS = ['SKU', 'Sku', 'sku'];

const EXACT_COPY_CANDIDATES = [
  'Item Title',
  'Description',
  'Shopify Price',
  'Ebay Price',
  'eBay Price',
  'Shopify Body (HTML)',
  'Ebay Body (HTML)',
  'Brand',
  'Model',
  'Category',
  'Subcategory',
  'Condition',
  'Make',
  'Component Type',
  'Template Name',
  'Testing Notes',
  'Inventory Notes',
];

const FIELD_ALIASES: Record<string, string[]> = {
  Make: ['Brand', 'make'],
  'Component Type': ['Component Type', 'component type', 'Type'],
  SKU: ['Sku', 'sku'],
  'Item Title': ['Title', 'Product Title', 'Name'],
  Description: ['Item Description', 'Product Description'],
  'Shopify Price': ['Price'],
  'Ebay Price': ['eBay Price', 'Price'],
  'eBay Price': ['Ebay Price', 'Price'],
  'Shopify Body (HTML)': ['Body (HTML)', 'Shopify Description HTML'],
  'Ebay Body (HTML)': ['eBay Body (HTML)', 'Body HTML'],
};

type ScriptCommand = 'plan' | 'apply' | 'unseed';
type PlanAction = 'create' | 'update' | 'skip' | 'conflict';

interface ScriptArgs {
  command: ScriptCommand;
  options: Record<string, string>;
}

interface PlanRow {
  sourceRecordId: string;
  sourceCreatedTime: string;
  dedupeKey: string;
  sourceStatus: string;
  sourceSku: string;
  mappedStatus: string;
  sourcePickupId: string;
  action: PlanAction;
  reason: string;
  targetRecordId?: string;
  fieldsToWrite: Record<string, unknown>;
}

interface PlanOutput {
  generatedAt: string;
  sourceBaseId: string;
  sourceTableId: string;
  sourceViewId: string;
  destBaseId: string;
  destTableId: string;
  targetWorkflowStatus: string;
  summary: Record<string, unknown>;
  rows: PlanRow[];
}

interface ApplyResultRow {
  sourceRecordId: string;
  dedupeKey: string;
  action: PlanAction;
  applied: boolean;
  targetRecordId?: string;
  message: string;
  wasCreated: boolean;
  fieldsWritten: string[];
  previousFields: Record<string, unknown>;
}

interface UnseedResultRow {
  type: 'delete-created' | 'restore-updated';
  recordId: string;
  ok: boolean;
  message: string;
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function setMergedEnv(): void {
  const mergedEnv = {
    ...readEnvFile(path.join(process.cwd(), '.env')),
    ...readEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  };

  for (const [key, value] of Object.entries(mergedEnv)) {
    if (typeof value === 'string' && !(key in process.env)) {
      process.env[key] = value;
    }
  }

  if (!process.env.AIRTABLE_API_KEY && mergedEnv.VITE_AIRTABLE_API_KEY) {
    process.env.AIRTABLE_API_KEY = mergedEnv.VITE_AIRTABLE_API_KEY;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function usage(): string {
  return [
    'Usage:',
    '  node --import tsx scripts/seed-photod-workflow-rows.ts plan [--stage "Approved for Publish"] [--output-dir path]',
    '  node --import tsx scripts/seed-photod-workflow-rows.ts apply --plan path/to/plan.json --confirm SEED_PHOTOD_WORKFLOW_ROWS [--output-dir path]',
    '  node --import tsx scripts/seed-photod-workflow-rows.ts unseed --apply-results path/to/apply-results.json --confirm UNSEED_PHOTOD_WORKFLOW_ROWS [--output-dir path]',
    '',
    'Stage examples:',
    '  --stage "Photography In Progress" (default)',
    '  --stage "Awaiting Pre-Listing Review"',
    '  --stage "Approved for Publish"',
    '  --stage "listing approval" (alias for Approved for Publish)',
  ].join('\n');
}

function normalizeStageValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
}

function resolveTargetWorkflowStatus(stageOptionValue: string | undefined): string {
  if (!stageOptionValue || !stageOptionValue.trim()) {
    return DEFAULT_TARGET_STAGE;
  }

  const requested = stageOptionValue.trim();
  if ((WORKFLOW_STATUSES as readonly string[]).includes(requested)) {
    return requested;
  }

  const normalized = normalizeStageValue(requested);
  const aliasMatch = STAGE_ALIASES[normalized];
  if (aliasMatch) {
    return aliasMatch;
  }

  throw new Error(
    `Invalid --stage value: ${stageOptionValue}. Use one of: ${WORKFLOW_STATUSES.join(', ')}`,
  );
}

function parseArgs(argv: string[]): ScriptArgs {
  const [rawCommand, ...rest] = argv;
  const command = (rawCommand || 'plan') as ScriptCommand;
  if (command !== 'plan' && command !== 'apply' && command !== 'unseed') {
    throw new Error(usage());
  }

  const options: Record<string, string> = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirectory(prefix: string, outputDir?: string): string {
  if (outputDir) {
    const resolved = path.resolve(outputDir);
    ensureDirectory(resolved);
    return resolved;
  }

  ensureDirectory(RUNS_DIR);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${prefix}-${stamp}`);
  ensureDirectory(runDir);
  return runDir;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getTrimmedString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    if (text) {
      return text;
    }

    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (name) {
      return name;
    }

    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (id) {
      return id;
    }
  }

  return '';
}

function getRawString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') {
      return record.text;
    }

    if (typeof record.name === 'string') {
      return record.name;
    }

    if (typeof record.id === 'string') {
      return record.id;
    }
  }

  return '';
}

function firstRawString(fields: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const raw = getRawString(fields[name]);
    if (raw.length > 0) {
      return raw;
    }
  }

  return '';
}

function firstTrimmedString(fields: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = getTrimmedString(fields[name]);
    if (value) {
      return value;
    }
  }

  return '';
}

function normalizeStatus(rawStatus: string): string {
  return rawStatus
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ');
}

function isPhotodStatus(rawStatus: string): boolean {
  const normalized = normalizeStatus(rawStatus);
  return normalized === "photo'd" || normalized === 'photod' || normalized === 'photo d';
}

function pickSourceValue(
  sourceFields: Record<string, unknown>,
  destinationFieldName: string,
): unknown {
  if (destinationFieldName in sourceFields) {
    return sourceFields[destinationFieldName];
  }

  for (const candidate of FIELD_ALIASES[destinationFieldName] ?? []) {
    if (candidate in sourceFields) {
      return sourceFields[candidate];
    }
  }

  return undefined;
}

function isImageFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('image') || normalized.startsWith('workflow image');
}

function buildWriteFields(
  sourceFields: Record<string, unknown>,
  destinationWritableFieldNames: Set<string>,
  destinationFieldTypeByName: Map<string, string>,
  dedupeKey: string,
  targetWorkflowStatus: string,
  sourcePickupId: string,
  existingRecord?: AirtableRecord,
): Record<string, unknown> {
  const fieldsToWrite: Record<string, unknown> = {};

  if (destinationWritableFieldNames.has('JotForm Submission ID')) {
    fieldsToWrite['JotForm Submission ID'] = dedupeKey;
  }

  if (destinationWritableFieldNames.has('Workflow Status')) {
    fieldsToWrite['Workflow Status'] = targetWorkflowStatus;
  }

  const sourceWorkflowSource = firstTrimmedString(sourceFields, SOURCE_WORKFLOW_SOURCE_FIELDS);
  if (destinationWritableFieldNames.has('Workflow Source')) {
    if (sourceWorkflowSource === 'JotForm' || sourceWorkflowSource === 'Manual Entry') {
      fieldsToWrite['Workflow Source'] = sourceWorkflowSource;
    } else {
      fieldsToWrite['Workflow Source'] = 'Manual Entry';
    }
  }

  if (destinationWritableFieldNames.has('Pick Up ID') && sourcePickupId.length > 0) {
    const existingPickup = getRawString(existingRecord?.fields?.['Pick Up ID']);
    if (!existingRecord || existingPickup.length === 0) {
      fieldsToWrite['Pick Up ID'] = sourcePickupId;
    }
  }

  for (const candidate of EXACT_COPY_CANDIDATES) {
    if (!destinationWritableFieldNames.has(candidate)) {
      continue;
    }

    if (isImageFieldName(candidate)) {
      continue;
    }

    const sourceValue = pickSourceValue(sourceFields, candidate);
    if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
      continue;
    }

    fieldsToWrite[candidate] = sourceValue;
  }

  for (const destinationFieldName of destinationWritableFieldNames) {
    if (destinationFieldName in fieldsToWrite) {
      continue;
    }

    if (MANAGED_FIELD_NAMES.has(destinationFieldName)) {
      continue;
    }

    if (isImageFieldName(destinationFieldName)) {
      continue;
    }

    const destinationFieldType = destinationFieldTypeByName.get(destinationFieldName);
    if (destinationFieldType === 'multipleAttachments') {
      continue;
    }

    const sourceValue = pickSourceValue(sourceFields, destinationFieldName);
    if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
      continue;
    }

    fieldsToWrite[destinationFieldName] = sourceValue;
  }

  // Preserve source SKU exactly when present in seed data.
  if (destinationWritableFieldNames.has('SKU')) {
    const sourceSku = firstTrimmedString(sourceFields, SOURCE_SKU_FIELDS);
    if (sourceSku) {
      fieldsToWrite.SKU = sourceSku;
    }
  }

  return fieldsToWrite;
}

function buildWritableFieldTypeMap(metadata: AirtableMetadataField[]): Map<string, string> {
  const writable = new Map<string, string>();
  for (const field of metadata) {
    if (NON_WRITABLE_FIELD_TYPES.has(field.type)) {
      continue;
    }

    writable.set(field.name, field.type);
  }

  return writable;
}

function summarizePlanRows(rows: PlanRow[]): Record<string, number> {
  const summary = {
    sourceRowsWithPhotodStatus: rows.length,
    creates: 0,
    updates: 0,
    skips: 0,
    conflicts: 0,
  };

  for (const row of rows) {
    if (row.action === 'create') summary.creates += 1;
    if (row.action === 'update') summary.updates += 1;
    if (row.action === 'skip') summary.skips += 1;
    if (row.action === 'conflict') summary.conflicts += 1;
  }

  return summary;
}

function buildDedupeKey(sourceRecordId: string): string {
  return `sb-photod:${sourceRecordId}`;
}

function buildSkuIndex(records: AirtableRecord[]): Map<string, AirtableRecord[]> {
  const index = new Map<string, AirtableRecord[]>();

  for (const record of records) {
    const sku = getTrimmedString(record.fields.SKU);
    if (!sku) {
      continue;
    }

    const entries = index.get(sku) || [];
    entries.push(record);
    index.set(sku, entries);
  }

  return index;
}

async function runPlan(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  requireEnv('AIRTABLE_API_KEY');

  const targetWorkflowStatus = resolveTargetWorkflowStatus(options.stage);

  const runDir = createRunDirectory('plan', options['output-dir']);

  const sourceRecords = await getRecords(SOURCE_BASE_ID, SOURCE_TABLE_ID, SOURCE_VIEW_ID);
  const destinationRecords = await getRecords(DEST_BASE_ID, DEST_TABLE_ID);
  const destinationFieldMetadata = await getTableMetadata(DEST_BASE_ID, DEST_TABLE_ID);
  const destinationFieldTypeByName = buildWritableFieldTypeMap(destinationFieldMetadata);
  const destinationWritableFieldNames = new Set(destinationFieldTypeByName.keys());

  const dedupeIndex = new Map<string, AirtableRecord[]>();
  for (const record of destinationRecords) {
    const dedupeValue = getTrimmedString(record.fields['JotForm Submission ID']);
    if (!dedupeValue) {
      continue;
    }

    const entries = dedupeIndex.get(dedupeValue) || [];
    entries.push(record);
    dedupeIndex.set(dedupeValue, entries);
  }

  const skuIndex = buildSkuIndex(destinationRecords);

  const rows: PlanRow[] = [];

  for (const sourceRecord of sourceRecords) {
    const sourceFields = sourceRecord.fields;
    const sourceStatusRaw = firstTrimmedString(sourceFields, SOURCE_STATUS_FIELDS);
    if (!sourceStatusRaw || !isPhotodStatus(sourceStatusRaw)) {
      continue;
    }

    const dedupeKey = buildDedupeKey(sourceRecord.id);
    const sourcePickupId = firstRawString(sourceFields, SOURCE_PICKUP_FIELDS);
    const sourceSku = firstTrimmedString(sourceFields, SOURCE_SKU_FIELDS);

    let action: PlanAction = 'skip';
    let reason = '';
    let targetRecordId: string | undefined;
    let fieldsToWrite: Record<string, unknown> = {};

    const existingMatches = dedupeIndex.get(dedupeKey) ?? [];
    if (existingMatches.length > 1) {
      action = 'conflict';
      reason = 'Multiple destination rows share this seed dedupe key';
    } else {
      const existing = existingMatches[0];
      targetRecordId = existing?.id;

      let matchedRecord = existing;
      if (!matchedRecord && sourceSku) {
        const skuMatches = skuIndex.get(sourceSku) ?? [];
        if (skuMatches.length > 1) {
          action = 'conflict';
          reason = 'Multiple destination rows share this SKU';
        } else if (skuMatches.length === 1) {
          matchedRecord = skuMatches[0];
          targetRecordId = matchedRecord.id;
        }
      }

      if (!reason) {
        action = matchedRecord ? 'update' : 'create';
        if (existing) {
          reason = 'Matched existing seeded row by dedupe key';
        } else if (matchedRecord) {
          reason = 'Matched existing destination row by SKU';
        } else {
          reason = 'No existing seeded row found';
        }

        fieldsToWrite = buildWriteFields(
          sourceFields,
          destinationWritableFieldNames,
          destinationFieldTypeByName,
          dedupeKey,
          targetWorkflowStatus,
          sourcePickupId,
          matchedRecord,
        );
      }
    }

    rows.push({
      sourceRecordId: sourceRecord.id,
      sourceCreatedTime: sourceRecord.createdTime,
      dedupeKey,
      sourceStatus: sourceStatusRaw,
      sourceSku,
      mappedStatus: targetWorkflowStatus,
      sourcePickupId,
      action,
      reason,
      targetRecordId,
      fieldsToWrite,
    });
  }

  const summary = summarizePlanRows(rows);
  const output: PlanOutput = {
    generatedAt: new Date().toISOString(),
    sourceBaseId: SOURCE_BASE_ID,
    sourceTableId: SOURCE_TABLE_ID,
    sourceViewId: SOURCE_VIEW_ID,
    destBaseId: DEST_BASE_ID,
    destTableId: DEST_TABLE_ID,
    targetWorkflowStatus,
    summary,
    rows,
  };

  writeJson(path.join(runDir, 'plan.json'), output);
  writeJson(path.join(runDir, 'summary.json'), summary);

  console.log('Plan completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Target stage: ${targetWorkflowStatus}`);
  console.log(`Rows with Photo'd status: ${summary.sourceRowsWithPhotodStatus}`);
  console.log(`Creates: ${summary.creates}, Updates: ${summary.updates}, Skips: ${summary.skips}, Conflicts: ${summary.conflicts}`);
}

function readPlan(planPath: string): PlanOutput {
  if (!fs.existsSync(planPath)) {
    throw new Error(`Plan file not found: ${planPath}`);
  }

  const raw = fs.readFileSync(planPath, 'utf8');
  return JSON.parse(raw) as PlanOutput;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runApply(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  requireEnv('AIRTABLE_API_KEY');

  const token = options.confirm || '';
  if (token !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply requires --confirm ${APPLY_CONFIRM_TOKEN}`);
  }

  const planPath = options.plan;
  if (!planPath) {
    throw new Error('Apply requires --plan path/to/plan.json');
  }

  const plan = readPlan(path.resolve(planPath));
  const runDir = createRunDirectory('apply', options['output-dir']);

  const destinationRecords = await getRecords(DEST_BASE_ID, DEST_TABLE_ID);
  const destinationById = new Map(destinationRecords.map((record) => [record.id, record]));
  const dedupeIndex = new Map<string, AirtableRecord>();

  for (const record of destinationRecords) {
    const dedupe = getTrimmedString(record.fields['JotForm Submission ID']);
    if (dedupe && !dedupeIndex.has(dedupe)) {
      dedupeIndex.set(dedupe, record);
    }
  }

  const results: ApplyResultRow[] = [];

  for (let index = 0; index < plan.rows.length; index += 1) {
    const row = plan.rows[index]!;

    if (row.action !== 'create' && row.action !== 'update') {
      results.push({
        sourceRecordId: row.sourceRecordId,
        dedupeKey: row.dedupeKey,
        action: row.action,
        applied: false,
        targetRecordId: row.targetRecordId,
        message: row.reason,
        wasCreated: false,
        fieldsWritten: [],
        previousFields: {},
      });
      continue;
    }

    try {
      const existingByDedupe = dedupeIndex.get(row.dedupeKey);
      const existingByTargetId = row.targetRecordId ? destinationById.get(row.targetRecordId) : undefined;
      const existing = existingByDedupe ?? existingByTargetId;
      let targetRecordId = existing?.id;
      let wasCreated = false;
      const previousFields: Record<string, unknown> = {};

      if (!existing) {
        const created = await createRecord(DEST_BASE_ID, DEST_TABLE_ID, row.fieldsToWrite, { typecast: true });
        targetRecordId = created.id;
        dedupeIndex.set(row.dedupeKey, created);
        destinationById.set(created.id, created);
        wasCreated = true;
      } else {
        for (const fieldName of Object.keys(row.fieldsToWrite)) {
          previousFields[fieldName] = existing.fields[fieldName];
        }

        await updateRecord(DEST_BASE_ID, DEST_TABLE_ID, existing.id, row.fieldsToWrite, { typecast: true });

        const nextFields = { ...existing.fields, ...row.fieldsToWrite };
        const nextRecord: AirtableRecord = {
          ...existing,
          fields: nextFields,
        };

        dedupeIndex.set(row.dedupeKey, nextRecord);
        destinationById.set(existing.id, nextRecord);
      }

      results.push({
        sourceRecordId: row.sourceRecordId,
        dedupeKey: row.dedupeKey,
        action: row.action,
        applied: true,
        targetRecordId,
        message: 'Applied successfully',
        wasCreated,
        fieldsWritten: Object.keys(row.fieldsToWrite),
        previousFields,
      });
    } catch (error) {
      results.push({
        sourceRecordId: row.sourceRecordId,
        dedupeKey: row.dedupeKey,
        action: row.action,
        applied: false,
        targetRecordId: row.targetRecordId,
        message: error instanceof Error ? error.message : String(error),
        wasCreated: false,
        fieldsWritten: Object.keys(row.fieldsToWrite),
        previousFields: {},
      });
    }

    if ((index + 1) % BATCH_SIZE === 0) {
      await sleep(250);
    }
  }

  const summary = {
    total: results.length,
    applied: results.filter((result) => result.applied).length,
    createdApplied: results.filter((result) => result.applied && result.wasCreated).length,
    updatedApplied: results.filter((result) => result.applied && !result.wasCreated && result.action === 'update').length,
    failed: results.filter((result) => !result.applied && (result.action === 'create' || result.action === 'update')).length,
    skipped: results.filter((result) => result.action === 'skip' || result.action === 'conflict').length,
  };

  writeJson(path.join(runDir, 'apply-results.json'), results);
  writeJson(path.join(runDir, 'summary.json'), summary);

  console.log('Apply completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Applied: ${summary.applied}, Created: ${summary.createdApplied}, Updated: ${summary.updatedApplied}, Failed: ${summary.failed}, Skipped: ${summary.skipped}`);
}

async function deleteDestinationRecord(recordId: string, apiKey: string): Promise<'deleted' | 'not-found'> {
  const encodedTableName = encodeURIComponent(DEST_TABLE_ID);
  const encodedRecordId = encodeURIComponent(recordId);
  const url = `https://api.airtable.com/v0/${DEST_BASE_ID}/${encodedTableName}/${encodedRecordId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.status === 404) {
    return 'not-found';
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete ${recordId}: HTTP ${response.status} ${text}`);
  }

  return 'deleted';
}

function readApplyResults(filePath: string): ApplyResultRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Apply results file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as ApplyResultRow[];
}

async function runUnseed(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  const apiKey = requireEnv('AIRTABLE_API_KEY');

  const token = options.confirm || '';
  if (token !== UNSEED_CONFIRM_TOKEN) {
    throw new Error(`Unseed requires --confirm ${UNSEED_CONFIRM_TOKEN}`);
  }

  const applyResultsPath = options['apply-results'];
  if (!applyResultsPath) {
    throw new Error('Unseed requires --apply-results path/to/apply-results.json');
  }

  const runDir = createRunDirectory('unseed', options['output-dir']);
  const results = readApplyResults(path.resolve(applyResultsPath));

  const createdRows = results.filter((result) => result.applied && result.wasCreated && result.targetRecordId);
  const updatedRows = results.filter((result) => result.applied && !result.wasCreated && result.targetRecordId && Object.keys(result.previousFields).length > 0);

  const unseedResults: UnseedResultRow[] = [];

  for (let index = 0; index < createdRows.length; index += 1) {
    const row = createdRows[index]!;
    const recordId = row.targetRecordId as string;

    try {
      const outcome = await deleteDestinationRecord(recordId, apiKey);
      unseedResults.push({
        type: 'delete-created',
        recordId,
        ok: outcome === 'deleted' || outcome === 'not-found',
        message: outcome === 'deleted' ? 'Deleted' : 'Already missing',
      });
    } catch (error) {
      unseedResults.push({
        type: 'delete-created',
        recordId,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if ((index + 1) % BATCH_SIZE === 0) {
      await sleep(250);
    }
  }

  for (let index = 0; index < updatedRows.length; index += 1) {
    const row = updatedRows[index]!;
    const recordId = row.targetRecordId as string;

    try {
      await updateRecord(DEST_BASE_ID, DEST_TABLE_ID, recordId, row.previousFields, { typecast: true });
      unseedResults.push({
        type: 'restore-updated',
        recordId,
        ok: true,
        message: 'Restored previous field values',
      });
    } catch (error) {
      unseedResults.push({
        type: 'restore-updated',
        recordId,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if ((index + 1) % BATCH_SIZE === 0) {
      await sleep(250);
    }
  }

  const summary = {
    createdCandidates: createdRows.length,
    updatedCandidates: updatedRows.length,
    deletedCreated: unseedResults.filter((row) => row.type === 'delete-created' && row.ok).length,
    restoredUpdated: unseedResults.filter((row) => row.type === 'restore-updated' && row.ok).length,
    failures: unseedResults.filter((row) => !row.ok).length,
  };

  writeJson(path.join(runDir, 'unseed-results.json'), unseedResults);
  writeJson(path.join(runDir, 'summary.json'), summary);

  console.log('Unseed completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Deleted created rows: ${summary.deletedCreated}`);
  console.log(`Restored updated rows: ${summary.restoredUpdated}`);
  console.log(`Failures: ${summary.failures}`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'plan') {
    await runPlan(options);
    return;
  }

  if (command === 'apply') {
    await runApply(options);
    return;
  }

  await runUnseed(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
