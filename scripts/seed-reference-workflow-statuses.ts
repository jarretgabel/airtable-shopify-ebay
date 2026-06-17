import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

import { createRecord, getRecords, getTableMetadata, updateRecord, type AirtableMetadataField, type AirtableRecord } from '../aws/src/providers/airtable/client.ts';

const SOURCE_BASE_ID = 'appjQj8FQfFZ2ogMz';
const SOURCE_TABLE_ID = 'tblirsoRIFPDMHxb0';
const SOURCE_VIEW_ID = 'viwaPByxQY4QBJS3K';
const DEST_BASE_ID = 'apprsAm2FOohEmL2u';
const DEST_TABLE_ID = 'tbl0K0nFQL64jQMx8';

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'reference-workflow-seed');
const APPLY_CONFIRM_TOKEN = 'SEED_REFERENCE_WORKFLOW_STATUSES';
const ROLLBACK_CONFIRM_TOKEN = 'ROLLBACK_SEED_REFERENCE_WORKFLOW_STATUSES';
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

type ScriptCommand = 'plan' | 'apply' | 'rollback';
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
  mappedStatus: string;
  sourcePickupId: string;
  action: PlanAction;
  reason: string;
  targetRecordId?: string;
  groupKey: string;
  fieldsToWrite: Record<string, unknown>;
}

interface PlanOutput {
  generatedAt: string;
  sourceBaseId: string;
  sourceTableId: string;
  sourceViewId: string;
  destBaseId: string;
  destTableId: string;
  filters: {
    year?: number;
    fromYear?: number;
    toYear?: number;
  };
  summary: Record<string, unknown>;
  statusMapping: Record<string, string | null>;
  rows: PlanRow[];
}

interface ApplyResultRow {
  sourceRecordId: string;
  dedupeKey: string;
  action: PlanAction;
  applied: boolean;
  targetRecordId?: string;
  groupKey: string;
  message: string;
  wasCreated: boolean;
}

interface RollbackResultRow {
  recordId: string;
  deleted: boolean;
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
    '  node --import tsx scripts/seed-reference-workflow-statuses.ts plan [--output-dir path] [--year N | --from-year N --to-year N]',
    '  node --import tsx scripts/seed-reference-workflow-statuses.ts apply --plan path/to/plan.json --confirm SEED_REFERENCE_WORKFLOW_STATUSES [--output-dir path]',
    '  node --import tsx scripts/seed-reference-workflow-statuses.ts rollback --apply-results path/to/apply-results.json --confirm ROLLBACK_SEED_REFERENCE_WORKFLOW_STATUSES [--output-dir path]',
  ].join('\n');
}

function parseArgs(argv: string[]): ScriptArgs {
  const [rawCommand, ...rest] = argv;
  const command = (rawCommand || 'plan') as ScriptCommand;
  if (command !== 'plan' && command !== 'apply' && command !== 'rollback') {
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

function parseYear(value: string | undefined, name: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 1900 || parsed > 3000) {
    throw new Error(`Invalid ${name}: ${value}`);
  }

  return parsed;
}

function parseYearFilter(options: Record<string, string>): { year?: number; fromYear?: number; toYear?: number } {
  const year = parseYear(options.year, 'year');
  const fromYear = parseYear(options['from-year'], 'from-year');
  const toYear = parseYear(options['to-year'], 'to-year');

  if (year && (fromYear || toYear)) {
    throw new Error('Use either --year N or --from-year/--to-year, not both.');
  }

  if (fromYear && toYear && fromYear > toYear) {
    throw new Error('--from-year must be less than or equal to --to-year.');
  }

  return { year, fromYear, toYear };
}

function isRecordInYearFilter(createdTime: string, filter: { year?: number; fromYear?: number; toYear?: number }): boolean {
  const date = new Date(createdTime);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const utcYear = date.getUTCFullYear();
  if (filter.year && utcYear !== filter.year) {
    return false;
  }

  if (filter.fromYear && utcYear < filter.fromYear) {
    return false;
  }

  if (filter.toYear && utcYear > filter.toYear) {
    return false;
  }

  return true;
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
  return typeof value === 'string' ? value.trim() : '';
}

function getRawString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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

function mapSourceStatus(rawStatus: string): string {
  const trimmed = rawStatus.trim();
  if (!trimmed) {
    return '';
  }

  if (APPROVED_WORKFLOW_STATUSES.has(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase();
  const map: Record<string, string> = {
    pending: 'Pending Review',
    'pending review': 'Pending Review',
    'new intake': 'Pending Review',
    unqualified: 'Unqualified',
    rejected: 'Unqualified',
    declined: 'Unqualified',
    trashed: 'Unqualified',
    accepted: 'Accepted - Awaiting Arrival',
    'awaiting arrival': 'Accepted - Awaiting Arrival',
    'arrived awaiting sku': 'Accepted - Arrived, Awaiting SKU',
    'awaiting sku': 'Accepted - Arrived, Awaiting SKU',
    'awaiting missing item': 'Accepted - Arrived, Awaiting Missing Item',
    'testing in progress': 'Testing In Progress',
    testing: 'Testing In Progress',
    'photography in progress': 'Photography In Progress',
    photography: 'Photography In Progress',
    'awaiting pre-listing review': 'Awaiting Pre-Listing Review',
    'approved for publish': 'Approved for Publish',
    'listed shopify': 'Listed, Shopify',
    'listed ebay': 'Listed, eBay',
    'stale shopify': 'Stale Listing, Shopify',
    'stale ebay': 'Stale Listing, eBay',
    sold: 'Sold - Ready to Ship',
    'sold ready to ship': 'Sold - Ready to Ship',
    shipped: 'Shipped',
    "photo'd": 'Photography In Progress',
    tested: 'Testing In Progress',
    'picked up': 'Accepted - Arrived, Awaiting SKU',
    'needs initial processing': 'Accepted - Arrived, Awaiting SKU',
    'waiting for unit': 'Accepted - Awaiting Arrival',
    'ready to list, pending aw approval': 'Awaiting Pre-Listing Review',
    '481 left behind': 'Unqualified',
    '481 salvage': 'Unqualified',
    '481 salvage, cleaned': 'Unqualified',
    tossed: 'Unqualified',
    held: 'Pending Review',
    'needs repair': 'Accepted - Arrived, Awaiting Missing Item',
    'listed, active': 'Listed, Shopify',
    'ready to test': 'Testing In Progress',
  };

  return map[normalized] || '';
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

function normalizeAttachmentValue(value: unknown): Array<{ url: string; filename?: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: Array<{ url: string; filename?: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;
    const url = getTrimmedString(record.url);
    if (!url) {
      continue;
    }

    const filename = getTrimmedString(record.filename) || getTrimmedString(record.name);
    if (filename) {
      normalized.push({ url, filename });
      continue;
    }

    normalized.push({ url });
  }

  return normalized.length > 0 ? normalized : undefined;
}

function buildWriteFields(
  sourceFields: Record<string, unknown>,
  destinationWritableFieldNames: Set<string>,
  destinationFieldTypeByName: Map<string, string>,
  dedupeKey: string,
  mappedStatus: string,
  sourcePickupId: string,
  existingRecord?: AirtableRecord,
): Record<string, unknown> {
  const fieldsToWrite: Record<string, unknown> = {};

  if (destinationWritableFieldNames.has('JotForm Submission ID')) {
    fieldsToWrite['JotForm Submission ID'] = dedupeKey;
  }

  if (destinationWritableFieldNames.has('Workflow Status')) {
    fieldsToWrite['Workflow Status'] = mappedStatus;
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

    const sourceValue = pickSourceValue(sourceFields, candidate);
    if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
      continue;
    }

    fieldsToWrite[candidate] = sourceValue;
  }

  // Copy any other fields that have a direct name match between source and destination.
  for (const destinationFieldName of destinationWritableFieldNames) {
    if (destinationFieldName in fieldsToWrite) {
      continue;
    }

    if (MANAGED_FIELD_NAMES.has(destinationFieldName)) {
      continue;
    }

    const sourceValue = pickSourceValue(sourceFields, destinationFieldName);
    if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
      continue;
    }

    const destinationFieldType = destinationFieldTypeByName.get(destinationFieldName);
    if (destinationFieldType === 'multipleAttachments') {
      const normalizedAttachments = normalizeAttachmentValue(sourceValue);
      if (!normalizedAttachments) {
        continue;
      }

      fieldsToWrite[destinationFieldName] = normalizedAttachments;
      continue;
    }

    fieldsToWrite[destinationFieldName] = sourceValue;
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
    sourceRowsInScope: rows.length,
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

function sanitizeForGroup(value: string, sourceRecordId: string): string {
  return value.length > 0 ? `pickup:${value}` : `nogroup:${sourceRecordId}`;
}

async function runPlan(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  requireEnv('AIRTABLE_API_KEY');

  const yearFilter = parseYearFilter(options);
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

  const rows: PlanRow[] = [];
  const statusMapping: Record<string, string | null> = {};
  const seenDedupeInSource = new Map<string, string>();

  for (const sourceRecord of sourceRecords) {
    if (!isRecordInYearFilter(sourceRecord.createdTime, yearFilter)) {
      continue;
    }

    const sourceFields = sourceRecord.fields;
    const sourceStatusRaw = firstTrimmedString(sourceFields, SOURCE_STATUS_FIELDS);
    if (!sourceStatusRaw) {
      continue;
    }

    const mappedStatus = mapSourceStatus(sourceStatusRaw);
    if (!(sourceStatusRaw in statusMapping)) {
      statusMapping[sourceStatusRaw] = mappedStatus || null;
    }

    const dedupeKey = `sb-ref:${sourceRecord.id}`;
    const sourcePickupId = firstRawString(sourceFields, SOURCE_PICKUP_FIELDS);

    let action: PlanAction = 'skip';
    let reason = '';
    let targetRecordId: string | undefined;
    let fieldsToWrite: Record<string, unknown> = {};

    if (!mappedStatus || !APPROVED_WORKFLOW_STATUSES.has(mappedStatus)) {
      action = 'skip';
      reason = `Unmapped source status: ${sourceStatusRaw}`;
    } else if (seenDedupeInSource.has(dedupeKey) && seenDedupeInSource.get(dedupeKey) !== sourceRecord.id) {
      action = 'conflict';
      reason = 'Duplicate source dedupe key collision in source records';
    } else {
      seenDedupeInSource.set(dedupeKey, sourceRecord.id);
      const existingMatches = dedupeIndex.get(dedupeKey) ?? [];

      if (existingMatches.length > 1) {
        action = 'conflict';
        reason = 'Multiple destination rows share the same dedupe key';
      } else {
        const existing = existingMatches[0];
        targetRecordId = existing?.id;

        if (existing) {
          const existingPickup = getRawString(existing.fields['Pick Up ID']);
          if (existingPickup.length > 0 && sourcePickupId.length > 0 && existingPickup !== sourcePickupId) {
            action = 'conflict';
            reason = 'Pickup-ID conflict: update would merge different raw Pickup-ID groups';
          } else {
            action = 'update';
            reason = 'Matched existing row by external dedupe key';
            fieldsToWrite = buildWriteFields(sourceFields, destinationWritableFieldNames, destinationFieldTypeByName, dedupeKey, mappedStatus, sourcePickupId, existing);
          }
        } else {
          action = 'create';
          reason = 'No existing row matched the external dedupe key';
          fieldsToWrite = buildWriteFields(sourceFields, destinationWritableFieldNames, destinationFieldTypeByName, dedupeKey, mappedStatus, sourcePickupId);
        }
      }
    }

    rows.push({
      sourceRecordId: sourceRecord.id,
      sourceCreatedTime: sourceRecord.createdTime,
      dedupeKey,
      sourceStatus: sourceStatusRaw,
      mappedStatus,
      sourcePickupId,
      action,
      reason,
      targetRecordId,
      groupKey: sanitizeForGroup(sourcePickupId, sourceRecord.id),
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
    filters: yearFilter,
    summary,
    statusMapping,
    rows,
  };

  writeJson(path.join(runDir, 'plan.json'), output);
  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'status-map.json'), statusMapping);

  console.log('Plan completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Source view: ${SOURCE_VIEW_ID}`);
  console.log(`Rows in scope: ${summary.sourceRowsInScope}`);
  console.log(`Creates: ${summary.creates}, Updates: ${summary.updates}, Skips: ${summary.skips}, Conflicts: ${summary.conflicts}`);
}

function readPlan(planPath: string): PlanOutput {
  if (!fs.existsSync(planPath)) {
    throw new Error(`Plan file not found: ${planPath}`);
  }

  const raw = fs.readFileSync(planPath, 'utf8');
  return JSON.parse(raw) as PlanOutput;
}

function groupRows(rows: PlanRow[]): Map<string, PlanRow[]> {
  const grouped = new Map<string, PlanRow[]>();

  for (const row of rows) {
    const entries = grouped.get(row.groupKey) || [];
    entries.push(row);
    grouped.set(row.groupKey, entries);
  }

  return grouped;
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
  const dedupeIndex = new Map<string, AirtableRecord>();
  for (const record of destinationRecords) {
    const dedupe = getTrimmedString(record.fields['JotForm Submission ID']);
    if (dedupe && !dedupeIndex.has(dedupe)) {
      dedupeIndex.set(dedupe, record);
    }
  }

  const grouped = groupRows(plan.rows);
  const results: ApplyResultRow[] = [];

  const groups = Array.from(grouped.entries());
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const [groupKey, rows] = groups[groupIndex]!;
    const actionableRows = rows.filter((row) => row.action === 'create' || row.action === 'update');

    if (actionableRows.length === 0) {
      for (const row of rows) {
        results.push({
          sourceRecordId: row.sourceRecordId,
          dedupeKey: row.dedupeKey,
          action: row.action,
          applied: false,
          targetRecordId: row.targetRecordId,
          groupKey,
          message: row.reason,
          wasCreated: false,
        });
      }
      continue;
    }

    let groupFailed = false;

    for (let index = 0; index < actionableRows.length; index += 1) {
      const row = actionableRows[index]!;
      if (groupFailed) {
        results.push({
          sourceRecordId: row.sourceRecordId,
          dedupeKey: row.dedupeKey,
          action: row.action,
          applied: false,
          targetRecordId: row.targetRecordId,
          groupKey,
          message: 'Skipped because previous row in group failed',
          wasCreated: false,
        });
        continue;
      }

      try {
        const existing = dedupeIndex.get(row.dedupeKey);
        let targetRecordId = existing?.id;
        let wasCreated = false;

        if (!existing) {
          const created = await createRecord(DEST_BASE_ID, DEST_TABLE_ID, row.fieldsToWrite, { typecast: true });
          targetRecordId = created.id;
          dedupeIndex.set(row.dedupeKey, created);
          wasCreated = true;
        } else {
          await updateRecord(DEST_BASE_ID, DEST_TABLE_ID, existing.id, row.fieldsToWrite, { typecast: true });
        }

        results.push({
          sourceRecordId: row.sourceRecordId,
          dedupeKey: row.dedupeKey,
          action: row.action,
          applied: true,
          targetRecordId,
          groupKey,
          message: 'Applied successfully',
          wasCreated,
        });
      } catch (error) {
        groupFailed = true;
        results.push({
          sourceRecordId: row.sourceRecordId,
          dedupeKey: row.dedupeKey,
          action: row.action,
          applied: false,
          targetRecordId: row.targetRecordId,
          groupKey,
          message: error instanceof Error ? error.message : String(error),
          wasCreated: false,
        });
      }

      if ((index + 1) % BATCH_SIZE === 0) {
        await sleep(250);
      }
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

async function runRollback(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  const apiKey = requireEnv('AIRTABLE_API_KEY');

  const token = options.confirm || '';
  if (token !== ROLLBACK_CONFIRM_TOKEN) {
    throw new Error(`Rollback requires --confirm ${ROLLBACK_CONFIRM_TOKEN}`);
  }

  const applyResultsPath = options['apply-results'];
  if (!applyResultsPath) {
    throw new Error('Rollback requires --apply-results path/to/apply-results.json');
  }

  const runDir = createRunDirectory('rollback', options['output-dir']);
  const results = readApplyResults(path.resolve(applyResultsPath));

  const createdIds = Array.from(new Set(
    results
      .filter((result) => result.applied && result.wasCreated && Boolean(result.targetRecordId))
      .map((result) => result.targetRecordId as string),
  ));

  const rollbackRows: RollbackResultRow[] = [];
  for (let index = 0; index < createdIds.length; index += 1) {
    const recordId = createdIds[index]!;

    try {
      const outcome = await deleteDestinationRecord(recordId, apiKey);
      rollbackRows.push({
        recordId,
        deleted: outcome === 'deleted',
        message: outcome === 'deleted' ? 'Deleted' : 'Already missing',
      });
    } catch (error) {
      rollbackRows.push({
        recordId,
        deleted: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if ((index + 1) % BATCH_SIZE === 0) {
      await sleep(250);
    }
  }

  const summary = {
    totalCandidates: createdIds.length,
    deleted: rollbackRows.filter((row) => row.deleted).length,
    alreadyMissing: rollbackRows.filter((row) => !row.deleted && row.message === 'Already missing').length,
    failed: rollbackRows.filter((row) => !row.deleted && row.message !== 'Already missing').length,
  };

  writeJson(path.join(runDir, 'rollback-results.json'), rollbackRows);
  writeJson(path.join(runDir, 'summary.json'), summary);

  console.log('Rollback completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Deleted: ${summary.deleted}, Already missing: ${summary.alreadyMissing}, Failed: ${summary.failed}`);
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

  await runRollback(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
