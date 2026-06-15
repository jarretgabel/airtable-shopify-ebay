import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

import { archiveWorkflowImagesToGoogleDrive, type WorkflowImageArchiveStage } from '../aws/src/providers/googleDrive/client.ts';
import { createRecord, getRecords, getTableMetadata, updateRecord, type AirtableRecord } from '../aws/src/providers/airtable/client.ts';

const SOURCE_BASE_ID = 'appjQj8FQfFZ2ogMz';
const SOURCE_TABLE_ID = 'tblirsoRIFPDMHxb0';
const DEST_BASE_ID = 'apprsAm2FOohEmL2u';
const DEST_TABLE_ID = 'tbl0K0nFQL64jQMx8';

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'reference-workflow-seed');
const APPLY_CONFIRM_TOKEN = 'SEED_REFERENCE_WORKFLOW_STATUSES';
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

const ALLOWED_WRITE_FIELDS = new Set([
  'JotForm Submission ID',
  'Workflow Status',
  'Workflow Source',
  'Pick Up ID',
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
  'Workflow Image Metadata JSON',
]);

const SKU_FIELD_MATCHERS = [/\bsku\b/i, /inventory sku/i];

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

const SOURCE_IMAGE_FIELDS = [
  'Images',
  'Image',
  'Photos',
  'Photo',
  'Attachments',
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
  'Item Title': ['Title', 'Product Title', 'Name'],
  'Description': ['Item Description', 'Product Description'],
  'Shopify Price': ['Price'],
  'Ebay Price': ['eBay Price', 'Price'],
  'eBay Price': ['Ebay Price', 'Price'],
  'Shopify Body (HTML)': ['Body (HTML)', 'Shopify Description HTML'],
  'Ebay Body (HTML)': ['eBay Body (HTML)', 'Body HTML'],
};

type ScriptCommand = 'plan' | 'apply';
type PlanAction = 'create' | 'update' | 'skip' | 'conflict';

interface ScriptArgs {
  command: ScriptCommand;
  options: Record<string, string>;
}

interface SourceAttachment {
  url: string;
  filename: string;
}

interface MetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt: string;
  sortOrder: number;
  sourceStage: 'intake' | 'testing' | 'photos';
  includedInListing: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PlanRow {
  sourceRecordId: string;
  dedupeKey: string;
  sourceStatus: string;
  mappedStatus: string;
  sourcePickupId: string;
  action: PlanAction;
  reason: string;
  targetRecordId?: string;
  groupKey: string;
  fieldsToWrite: Record<string, unknown>;
  sourceImageAttachments: SourceAttachment[];
}

interface PlanOutput {
  generatedAt: string;
  sourceBaseId: string;
  sourceTableId: string;
  destBaseId: string;
  destTableId: string;
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
  imagesUploaded: number;
}

interface UploadCheckpointRecord {
  attachmentUrl: string;
  processedFileId: string;
  processedFilename: string;
  processedUrl: string;
  originalFileId: string;
  originalFilename: string;
  originalUrl: string;
  stage: WorkflowImageArchiveStage;
}

type UploadCheckpoint = Record<string, UploadCheckpointRecord>;

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

  if (!process.env.GOOGLE_DRIVE_CLIENT_ID && mergedEnv.VITE_GOOGLE_DRIVE_CLIENT_ID) {
    process.env.GOOGLE_DRIVE_CLIENT_ID = mergedEnv.VITE_GOOGLE_DRIVE_CLIENT_ID;
  }
  if (!process.env.GOOGLE_DRIVE_CLIENT_SECRET && mergedEnv.VITE_GOOGLE_DRIVE_CLIENT_SECRET) {
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = mergedEnv.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
  }
  if (!process.env.GOOGLE_DRIVE_REFRESH_TOKEN && mergedEnv.VITE_GOOGLE_DRIVE_REFRESH_TOKEN) {
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = mergedEnv.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;
  }
  if (!process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID && mergedEnv.VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID) {
    process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = mergedEnv.VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseArgs(argv: string[]): ScriptArgs {
  const [rawCommand, ...rest] = argv;
  const command = (rawCommand || 'plan') as ScriptCommand;
  if (command !== 'plan' && command !== 'apply') {
    throw new Error('Usage: node --import tsx scripts/seed-reference-workflow-statuses.ts [plan|apply] [--plan path] [--output-dir path]');
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

function parseAttachments(value: unknown): SourceAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attachments: SourceAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;
    const url = getTrimmedString(record.url);
    if (!url) {
      continue;
    }

    const filename = getTrimmedString(record.filename)
      || getTrimmedString(record.name)
      || url.split('/').pop()?.split('?')[0]
      || 'image.jpg';

    attachments.push({ url, filename });
  }

  return attachments;
}

function extractSourceAttachments(fields: Record<string, unknown>): SourceAttachment[] {
  for (const field of SOURCE_IMAGE_FIELDS) {
    const attachments = parseAttachments(fields[field]);
    if (attachments.length > 0) {
      return attachments;
    }
  }

  return [];
}

function hasSkuLikeField(fieldName: string): boolean {
  return SKU_FIELD_MATCHERS.some((pattern) => pattern.test(fieldName));
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

function stageForStatus(status: string): WorkflowImageArchiveStage {
  if (status === 'Testing In Progress') {
    return 'testing';
  }

  if (status === 'Pending Review'
    || status === 'Accepted - Awaiting Arrival'
    || status === 'Accepted - Arrived, Awaiting SKU'
    || status === 'Accepted - Arrived, Awaiting Missing Item') {
    return 'intake';
  }

  return 'photos';
}

function parseMetadata(raw: unknown): MetadataRecord[] {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is MetadataRecord => Boolean(entry && typeof entry === 'object')) as MetadataRecord[];
  } catch {
    return [];
  }
}

function serializeMetadata(records: MetadataRecord[]): string {
  if (records.length === 0) {
    return '';
  }

  const sorted = [...records]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((record, index) => ({
      ...record,
      sortOrder: index + 1,
    }));

  return JSON.stringify(sorted);
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

function buildWriteFields(
  sourceFields: Record<string, unknown>,
  destinationFieldNames: Set<string>,
  dedupeKey: string,
  mappedStatus: string,
  sourcePickupId: string,
  existingRecord?: AirtableRecord,
): Record<string, unknown> {
  const fieldsToWrite: Record<string, unknown> = {};

  if (destinationFieldNames.has('JotForm Submission ID')) {
    fieldsToWrite['JotForm Submission ID'] = dedupeKey;
  }

  if (destinationFieldNames.has('Workflow Status')) {
    fieldsToWrite['Workflow Status'] = mappedStatus;
  }

  const sourceWorkflowSource = firstTrimmedString(sourceFields, SOURCE_WORKFLOW_SOURCE_FIELDS);
  if (destinationFieldNames.has('Workflow Source')) {
    if (sourceWorkflowSource === 'JotForm' || sourceWorkflowSource === 'Manual Entry') {
      fieldsToWrite['Workflow Source'] = sourceWorkflowSource;
    } else {
      fieldsToWrite['Workflow Source'] = 'Manual Entry';
    }
  }

  if (destinationFieldNames.has('Pick Up ID') && sourcePickupId.length > 0) {
    const existingPickup = getRawString(existingRecord?.fields?.['Pick Up ID']);
    if (!existingRecord || existingPickup.length === 0) {
      fieldsToWrite['Pick Up ID'] = sourcePickupId;
    }
  }

  for (const candidate of EXACT_COPY_CANDIDATES) {
    if (!destinationFieldNames.has(candidate)) {
      continue;
    }

    const sourceValue = pickSourceValue(sourceFields, candidate);
    if (sourceValue === undefined || sourceValue === null || sourceValue === '') {
      continue;
    }

    fieldsToWrite[candidate] = sourceValue;
  }

  const filtered: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(fieldsToWrite)) {
    if (!ALLOWED_WRITE_FIELDS.has(field)) {
      continue;
    }

    if (hasSkuLikeField(field)) {
      continue;
    }

    filtered[field] = value;
  }

  return filtered;
}

function summarizePlanRows(rows: PlanRow[]): Record<string, number> {
  const summary = {
    sourceRowsInScope: rows.length,
    creates: 0,
    updates: 0,
    skips: 0,
    conflicts: 0,
    withImages: 0,
  };

  for (const row of rows) {
    if (row.action === 'create') summary.creates += 1;
    if (row.action === 'update') summary.updates += 1;
    if (row.action === 'skip') summary.skips += 1;
    if (row.action === 'conflict') summary.conflicts += 1;
    if (row.sourceImageAttachments.length > 0) summary.withImages += 1;
  }

  return summary;
}

function sanitizeForGroup(value: string, sourceRecordId: string): string {
  return value.length > 0 ? `pickup:${value}` : `nogroup:${sourceRecordId}`;
}

async function runPlan(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  requireEnv('AIRTABLE_API_KEY');
  requireEnv('GOOGLE_DRIVE_CLIENT_ID');
  requireEnv('GOOGLE_DRIVE_CLIENT_SECRET');
  requireEnv('GOOGLE_DRIVE_REFRESH_TOKEN');

  const runDir = createRunDirectory('plan', options['output-dir']);

  const sourceRecords = await getRecords(SOURCE_BASE_ID, SOURCE_TABLE_ID);
  const destinationRecords = await getRecords(DEST_BASE_ID, DEST_TABLE_ID);
  const destinationFieldMetadata = await getTableMetadata(DEST_BASE_ID, DEST_TABLE_ID);
  const destinationFieldNames = new Set(destinationFieldMetadata.map((field) => field.name));

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
    const attachments = extractSourceAttachments(sourceFields);

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
            fieldsToWrite = buildWriteFields(sourceFields, destinationFieldNames, dedupeKey, mappedStatus, sourcePickupId, existing);
          }
        } else {
          action = 'create';
          reason = 'No existing row matched the external dedupe key';
          fieldsToWrite = buildWriteFields(sourceFields, destinationFieldNames, dedupeKey, mappedStatus, sourcePickupId);
        }
      }
    }

    rows.push({
      sourceRecordId: sourceRecord.id,
      dedupeKey,
      sourceStatus: sourceStatusRaw,
      mappedStatus,
      sourcePickupId,
      action,
      reason,
      targetRecordId,
      groupKey: sanitizeForGroup(sourcePickupId, sourceRecord.id),
      fieldsToWrite,
      sourceImageAttachments: attachments,
    });
  }

  const summary = summarizePlanRows(rows);
  const output: PlanOutput = {
    generatedAt: new Date().toISOString(),
    sourceBaseId: SOURCE_BASE_ID,
    sourceTableId: SOURCE_TABLE_ID,
    destBaseId: DEST_BASE_ID,
    destTableId: DEST_TABLE_ID,
    summary,
    statusMapping,
    rows,
  };

  writeJson(path.join(runDir, 'plan.json'), output);
  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'status-map.json'), statusMapping);

  console.log('Plan completed.');
  console.log(`Run directory: ${runDir}`);
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

function loadCheckpoint(filePath: string): UploadCheckpoint {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as UploadCheckpoint;
}

function saveCheckpoint(filePath: string, checkpoint: UploadCheckpoint): void {
  writeJson(filePath, checkpoint);
}

async function downloadAsBase64(url: string): Promise<{ base64: string; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download source image (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  return {
    base64: Buffer.from(arrayBuffer).toString('base64'),
    contentType,
  };
}

function createMetadataEntry(
  upload: UploadCheckpointRecord,
  stage: WorkflowImageArchiveStage,
  sortOrder: number,
): MetadataRecord {
  const now = new Date().toISOString();

  return {
    attachmentId: upload.processedFileId,
    url: upload.processedUrl,
    filename: upload.processedFilename,
    alt: '',
    sortOrder,
    sourceStage: stage,
    includedInListing: stage !== 'intake',
    createdAt: now,
    updatedAt: now,
  };
}

async function uploadImagesForRow(
  row: PlanRow,
  targetRecordId: string,
  existingMetadataRaw: unknown,
  checkpointPath: string,
): Promise<{ metadataJson: string; imagesUploaded: number }> {
  const existingMetadata = parseMetadata(existingMetadataRaw);
  const checkpoint = loadCheckpoint(checkpointPath);

  const stage = stageForStatus(row.mappedStatus);
  const nextMetadata = [...existingMetadata];
  let uploadedCount = 0;

  for (const attachment of row.sourceImageAttachments) {
    const checkpointKey = `${row.sourceRecordId}|${attachment.url}`;
    let checkpointRecord = checkpoint[checkpointKey];

    if (!checkpointRecord) {
      const downloaded = await downloadAsBase64(attachment.url);
      const archiveResult = await archiveWorkflowImagesToGoogleDrive({
        folderKey: targetRecordId,
        stage,
        original: {
          filename: attachment.filename,
          contentType: downloaded.contentType,
          file: downloaded.base64,
        },
        processed: {
          filename: attachment.filename,
          contentType: downloaded.contentType,
          file: downloaded.base64,
        },
      });

      checkpointRecord = {
        attachmentUrl: attachment.url,
        processedFileId: archiveResult.processed.id,
        processedFilename: archiveResult.processed.filename,
        processedUrl: archiveResult.processed.url,
        originalFileId: archiveResult.original.id,
        originalFilename: archiveResult.original.filename,
        originalUrl: archiveResult.original.url,
        stage,
      };

      checkpoint[checkpointKey] = checkpointRecord;
      saveCheckpoint(checkpointPath, checkpoint);
      uploadedCount += 1;
    }

    const alreadyPresent = nextMetadata.some(
      (record) => record.attachmentId === checkpointRecord.processedFileId || record.url === checkpointRecord.processedUrl,
    );

    if (!alreadyPresent) {
      nextMetadata.push(createMetadataEntry(checkpointRecord, stage, nextMetadata.length + 1));
    }
  }

  return {
    metadataJson: serializeMetadata(nextMetadata),
    imagesUploaded: uploadedCount,
  };
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

async function runApply(options: Record<string, string>): Promise<void> {
  setMergedEnv();
  requireEnv('AIRTABLE_API_KEY');
  requireEnv('GOOGLE_DRIVE_CLIENT_ID');
  requireEnv('GOOGLE_DRIVE_CLIENT_SECRET');
  requireEnv('GOOGLE_DRIVE_REFRESH_TOKEN');

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
  const checkpointPath = path.join(runDir, 'upload-checkpoint.json');

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
          imagesUploaded: 0,
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
          imagesUploaded: 0,
        });
        continue;
      }

      try {
        const existing = dedupeIndex.get(row.dedupeKey);
        let targetRecordId = existing?.id;

        if (!existing) {
          const created = await createRecord(DEST_BASE_ID, DEST_TABLE_ID, row.fieldsToWrite, { typecast: true });
          targetRecordId = created.id;
          dedupeIndex.set(row.dedupeKey, created);
        } else {
          await updateRecord(DEST_BASE_ID, DEST_TABLE_ID, existing.id, row.fieldsToWrite, { typecast: true });
        }

        let imagesUploaded = 0;
        if (row.sourceImageAttachments.length > 0 && targetRecordId) {
          const latestRecord = await getRecords(DEST_BASE_ID, DEST_TABLE_ID, undefined, {
            filterByFormula: `RECORD_ID()='${targetRecordId}'`,
          });
          const current = latestRecord[0];
          const imageResult = await uploadImagesForRow(
            row,
            targetRecordId,
            current?.fields?.['Workflow Image Metadata JSON'],
            checkpointPath,
          );
          imagesUploaded = imageResult.imagesUploaded;

          if (imageResult.metadataJson) {
            await updateRecord(DEST_BASE_ID, DEST_TABLE_ID, targetRecordId, {
              'Workflow Image Metadata JSON': imageResult.metadataJson,
            });
          }
        }

        results.push({
          sourceRecordId: row.sourceRecordId,
          dedupeKey: row.dedupeKey,
          action: row.action,
          applied: true,
          targetRecordId,
          groupKey,
          message: 'Applied successfully',
          imagesUploaded,
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
          imagesUploaded: 0,
        });
      }

      if ((index + 1) % BATCH_SIZE === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
  }

  const summary = {
    total: results.length,
    applied: results.filter((result) => result.applied).length,
    failed: results.filter((result) => !result.applied && (result.action === 'create' || result.action === 'update')).length,
    skipped: results.filter((result) => result.action === 'skip' || result.action === 'conflict').length,
    imagesUploaded: results.reduce((acc, row) => acc + row.imagesUploaded, 0),
  };

  writeJson(path.join(runDir, 'apply-results.json'), results);
  writeJson(path.join(runDir, 'summary.json'), summary);

  console.log('Apply completed.');
  console.log(`Run directory: ${runDir}`);
  console.log(`Applied: ${summary.applied}, Failed: ${summary.failed}, Skipped: ${summary.skipped}, Images uploaded: ${summary.imagesUploaded}`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'plan') {
    await runPlan(options);
    return;
  }

  await runApply(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
