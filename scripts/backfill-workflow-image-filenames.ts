import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { getConfiguredRecords, updateConfiguredRecord } from '../aws/src/providers/airtable/sources.ts';
import { renameWorkflowArchivedFile } from '../aws/src/providers/googleDrive/client.ts';

type WorkflowStage = 'intake' | 'testing' | 'photos';

interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt?: string;
  imageRole?: string;
  customImageRole?: string;
  sourceStage?: WorkflowStage;
  includedInListing?: boolean;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface RenameCandidate {
  index: number;
  fileId: string;
  stage: WorkflowStage;
  oldFilename: string;
  nextFilename: string;
  oldUrl: string;
}

interface StageCandidateEntry {
  index: number;
  entry: WorkflowImageMetadataRecord;
  fileId: string;
}

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'workflow-image-filename-backfill');
const APPLY_CONFIRM_TOKEN = 'RENAME_WORKFLOW_PROCESSED_IMAGES';
const TARGET_STAGES = new Set<WorkflowStage>(['testing', 'photos']);
const CAMERA_TOKEN_PATTERN = /^(img|dsc|pxl|pixel|canon|nikon|sony|iphone|gopro|v\d+)\d*$/;
const RECORD_TOKEN_PATTERN = /^rec[a-z0-9]+$/i;
const LOW_SIGNAL_TOKENS = new Set([
  'sample',
  'testing',
  'photos',
  'photo',
  'pending',
  'listing',
  'live',
  'stale',
  'sold',
  'ready',
  'shopify',
  'ebay',
  'workflow',
  'queue',
  'processed',
  'edited',
  'original',
]);
const ROLE_BY_STAGE_INDEX: Record<WorkflowStage, string[]> = {
  intake: ['front', 'rear', 'detail', 'connections', 'serial-plate'],
  testing: ['front', 'rear', 'serial-plate', 'connections', 'cosmetic-detail'],
  photos: ['front', 'rear', 'cosmetic-detail', 'connections', 'serial-plate'],
};

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

function setMergedEnv() {
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

  if (!process.env.AIRTABLE_BASE_ID && mergedEnv.VITE_AIRTABLE_BASE_ID) {
    process.env.AIRTABLE_BASE_ID = mergedEnv.VITE_AIRTABLE_BASE_ID;
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

  if (!process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF && mergedEnv.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF) {
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = mergedEnv.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF;
  }

  if (!process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME && mergedEnv.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME) {
    process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = mergedEnv.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME;
  }
}

function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function createRunDirectory(prefix: string): string {
  ensureDirectory(RUNS_DIR);
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${prefix}-${stamp}`);
  ensureDirectory(runDir);
  return runDir;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseArgs(argv: string[]): { command: string; options: Record<string, string> } {
  const [command = 'plan', ...rest] = argv;
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

function parseMetadata(raw: unknown): WorkflowImageMetadataRecord[] {
  if (Array.isArray(raw)) {
    return raw as WorkflowImageMetadataRecord[];
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed as WorkflowImageMetadataRecord[];
      }
    } catch {
      return [];
    }
  }

  return [];
}

function serializeMetadata(records: WorkflowImageMetadataRecord[]): string {
  if (records.length === 0) return '';
  return JSON.stringify(records);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeToken(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !CAMERA_TOKEN_PATTERN.test(token))
    .filter((token) => !RECORD_TOKEN_PATTERN.test(token))
    .filter((token) => !LOW_SIGNAL_TOKENS.has(token));
}

function sanitizeRoleTokens(tokens: string[]): string[] {
  const deduped: string[] = [];
  for (const token of tokens) {
    if (!token || LOW_SIGNAL_TOKENS.has(token) || deduped.includes(token)) {
      continue;
    }
    deduped.push(token);
  }

  return deduped;
}

function inferRoleFromStageIndex(stage: WorkflowStage, position: number): string[] {
  const roleTokens = ROLE_BY_STAGE_INDEX[stage] ?? ROLE_BY_STAGE_INDEX.testing;
  const role = roleTokens[Math.max(0, Math.min(position, roleTokens.length - 1))] ?? 'detail';
  return role.split('-');
}

function inferSequenceFromFilename(filename: string): number {
  const normalized = filename.toLowerCase();
  const match = normalized.match(/-(\d+)-(?:processed|edited)(?:\.|$)/i)
    || normalized.match(/(?:testing|photos)-(\d+)-/i);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeRoleToken(record: WorkflowImageMetadataRecord, stage: WorkflowStage, stagePosition: number): string[] {
  if (record.imageRole === 'custom') {
    const customTokens = sanitizeRoleTokens(normalizeToken(record.customImageRole ?? ''));
    return customTokens.length > 0 ? customTokens : inferRoleFromStageIndex(stage, stagePosition);
  }

  if (record.imageRole) {
    const roleTokens = sanitizeRoleTokens(normalizeToken(record.imageRole));
    return roleTokens.length > 0 ? roleTokens : inferRoleFromStageIndex(stage, stagePosition);
  }

  return inferRoleFromStageIndex(stage, stagePosition);
}

function toFilename(make: string, model: string, componentType: string, roleTokens: string[]): string {
  const makeTokens = normalizeToken(make);
  const modelTokens = normalizeToken(model);
  const componentTokens = normalizeToken(componentType);
  const roleTokenList = sanitizeRoleTokens(roleTokens);

  const tokens = [
    ...makeTokens,
    ...modelTokens,
    ...(componentTokens.length > 0 ? componentTokens : ['audio', 'component']),
    ...(roleTokenList.length > 0 ? roleTokenList : ['detail']),
  ].slice(0, 10);

  while (tokens.length < 5) {
    tokens.push('image');
  }

  return `${tokens.join('-')}.jpg`;
}

function extractDriveFileId(record: WorkflowImageMetadataRecord): string {
  const byAttachmentId = getString(record.attachmentId);
  if (byAttachmentId) {
    return byAttachmentId;
  }

  const url = getString(record.url);
  if (!url) return '';

  const queryId = url.match(/[?&]id=([^&]+)/i)?.[1];
  if (queryId) {
    return decodeURIComponent(queryId);
  }

  const filePathId = url.match(/\/d\/([^/]+)/i)?.[1];
  if (filePathId) {
    return decodeURIComponent(filePathId);
  }

  return '';
}

function isProcessedStageImage(record: WorkflowImageMetadataRecord): boolean {
  const stage = record.sourceStage;
  if (!stage || !TARGET_STAGES.has(stage)) {
    return false;
  }

  const filename = getString(record.filename).toLowerCase();
  if (!filename) return false;

  return !filename.includes('--original');
}

function buildRenameCandidates(recordFields: Record<string, unknown>): RenameCandidate[] {
  const make = getString(recordFields.Make);
  const model = getString(recordFields.Model);
  const componentType = getString(recordFields['Component Type']);
  const metadata = parseMetadata(recordFields['Workflow Image Metadata JSON']);
  const seenFilenames = new Set<string>();

  const stageBuckets = new Map<WorkflowStage, StageCandidateEntry[]>();
  metadata.forEach((entry, index) => {
    if (!isProcessedStageImage(entry)) {
      return;
    }

    const fileId = extractDriveFileId(entry);
    if (!fileId) {
      return;
    }

    const stage = entry.sourceStage as WorkflowStage;
    const bucket = stageBuckets.get(stage) ?? [];
    bucket.push({
      index,
      entry,
      fileId,
    });
    stageBuckets.set(stage, bucket);
  });

  const candidates: RenameCandidate[] = [];
  for (const [stage, entries] of stageBuckets.entries()) {
    const sortedEntries = [...entries].sort((left, right) => {
      const bySortOrder = (left.entry.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.entry.sortOrder ?? Number.MAX_SAFE_INTEGER);
      if (bySortOrder !== 0) return bySortOrder;

      const byFilenameSequence = inferSequenceFromFilename(left.entry.filename) - inferSequenceFromFilename(right.entry.filename);
      if (byFilenameSequence !== 0) return byFilenameSequence;

      return left.entry.filename.localeCompare(right.entry.filename);
    });

    sortedEntries.forEach((stageEntry, stageIndex) => {
      const roleTokens = normalizeRoleToken(stageEntry.entry, stage, stageIndex);
      const baseFilename = toFilename(make, model, componentType, roleTokens);
      let nextFilename = baseFilename;
      let suffix = 2;
      let stageApplied = false;

      while (seenFilenames.has(nextFilename.toLowerCase())) {
        if (!stageApplied) {
          nextFilename = baseFilename.replace(/\.jpg$/i, `-${stage}.jpg`);
          stageApplied = true;
          continue;
        }

        nextFilename = baseFilename.replace(/\.jpg$/i, `-${stage}-${suffix}.jpg`);
        suffix += 1;
      }

      seenFilenames.add(nextFilename.toLowerCase());

      const oldFilename = getString(stageEntry.entry.filename);
      if (oldFilename.toLowerCase() === nextFilename.toLowerCase()) {
        return;
      }

      candidates.push({
        index: stageEntry.index,
        fileId: stageEntry.fileId,
        stage,
        oldFilename,
        nextFilename,
        oldUrl: getString(stageEntry.entry.url),
      });
    });
  }

  return candidates;
}

function updateRecordImages(
  imagesRaw: unknown,
  renameByFileId: Map<string, { filename: string; url: string }>,
): Array<{ id?: string; url?: string; filename: string }> {
  if (!Array.isArray(imagesRaw)) {
    return [];
  }

  return imagesRaw.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry as { id?: string; url?: string; filename: string };
    }

    const image = entry as { id?: unknown; url?: unknown; filename?: unknown; name?: unknown };
    const fileId = typeof image.id === 'string' ? image.id.trim() : '';
    const match = fileId ? renameByFileId.get(fileId) : undefined;
    if (!match) {
      return {
        id: typeof image.id === 'string' ? image.id : undefined,
        url: typeof image.url === 'string' ? image.url : undefined,
        filename: typeof image.filename === 'string'
          ? image.filename
          : typeof image.name === 'string'
            ? image.name
            : '',
      };
    }

    return {
      id: fileId,
      url: match.url,
      filename: match.filename,
    };
  });
}

async function loadRecords() {
  return getConfiguredRecords('used-gear-workflow', {
    fields: [
      'SKU',
      'Make',
      'Model',
      'Component Type',
      'Images',
      'Workflow Image Metadata JSON',
    ],
  });
}

async function runPlan() {
  const runDir = createRunDirectory('plan');
  const records = await loadRecords();
  const planRows: Array<Record<string, unknown>> = [];

  for (const record of records) {
    const candidates = buildRenameCandidates(record.fields);
    if (candidates.length === 0) continue;

    for (const candidate of candidates) {
      planRows.push({
        recordId: record.id,
        sku: getString(record.fields.SKU),
        make: getString(record.fields.Make),
        model: getString(record.fields.Model),
        componentType: getString(record.fields['Component Type']),
        stage: candidate.stage,
        fileId: candidate.fileId,
        oldFilename: candidate.oldFilename,
        nextFilename: candidate.nextFilename,
        oldUrl: candidate.oldUrl,
      });
    }
  }

  const summary = {
    createdAt: new Date().toISOString(),
    mode: 'plan',
    totalRecords: records.length,
    recordsWithRenames: new Set(planRows.map((row) => row.recordId)).size,
    renameCount: planRows.length,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'rename-plan.json'), planRows);

  console.log(`Plan generated in ${runDir}`);
  console.log(`Records scanned: ${summary.totalRecords}`);
  console.log(`Records with rename candidates: ${summary.recordsWithRenames}`);
  console.log(`Processed image renames proposed: ${summary.renameCount}`);
}

async function runApply(confirm: string) {
  if (confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  const runDir = createRunDirectory('apply');
  const records = await loadRecords();
  const applyRows: Array<Record<string, unknown>> = [];

  for (const record of records) {
    const candidates = buildRenameCandidates(record.fields);
    if (candidates.length === 0) continue;

    const metadata = parseMetadata(record.fields['Workflow Image Metadata JSON']);
    const renameByFileId = new Map<string, { filename: string; url: string }>();

    for (const candidate of candidates) {
      const renamed = await renameWorkflowArchivedFile(candidate.fileId, candidate.nextFilename);
      renameByFileId.set(candidate.fileId, {
        filename: renamed.filename,
        url: renamed.url,
      });

      const current = metadata[candidate.index];
      if (current) {
        current.filename = renamed.filename;
        current.url = renamed.url;
        current.attachmentId = renamed.id;
        current.sourceStage = candidate.stage;
        current.updatedAt = new Date().toISOString();
      }

      applyRows.push({
        recordId: record.id,
        fileId: candidate.fileId,
        stage: candidate.stage,
        oldFilename: candidate.oldFilename,
        nextFilename: renamed.filename,
      });
    }

    const nextImages = updateRecordImages(record.fields.Images, renameByFileId);

    await updateConfiguredRecord(
      'used-gear-workflow',
      record.id,
      {
        Images: nextImages,
        'Workflow Image Metadata JSON': serializeMetadata(metadata),
      },
      { typecast: true },
    );
  }

  const summary = {
    createdAt: new Date().toISOString(),
    mode: 'apply',
    renamedCount: applyRows.length,
    recordsUpdated: new Set(applyRows.map((row) => row.recordId)).size,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'rename-apply.json'), applyRows);

  console.log(`Apply completed in ${runDir}`);
  console.log(`Records updated: ${summary.recordsUpdated}`);
  console.log(`Processed images renamed: ${summary.renamedCount}`);
}

async function main() {
  setMergedEnv();
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'plan') {
    await runPlan();
    return;
  }

  if (command === 'apply') {
    await runApply(options.confirm ?? '');
    return;
  }

  throw new Error('Usage: node --import tsx scripts/backfill-workflow-image-filenames.ts [plan|apply] [--confirm TOKEN]');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
