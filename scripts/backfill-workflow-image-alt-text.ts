import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { getConfiguredRecords, updateConfiguredRecord } from '../aws/src/providers/airtable/sources.ts';

type WorkflowImageSourceStage = 'intake' | 'testing' | 'photos';

interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt?: string;
  imageRole?: string;
  customImageRole?: string;
  sortOrder?: number;
  sourceStage?: WorkflowImageSourceStage;
  includedInListing?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AltBackfillChange {
  index: number;
  oldAlt: string;
  newAlt: string;
  filename: string;
  url: string;
}

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'workflow-image-alt-backfill');
const APPLY_CONFIRM_TOKEN = 'BACKFILL_WORKFLOW_IMAGE_ALT_TEXT';

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

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function extractFilename(url: string, filename: string): string {
  const normalizedFilename = getString(filename);
  if (normalizedFilename) {
    return normalizedFilename;
  }

  return getString(url.split('/').pop() ?? '');
}

function extractFilenameStem(filename: string): string {
  return filename.trim().replace(/\.[^.]+$/, '');
}

function isLegacyWorkflowAltText(alt: string): boolean {
  const normalized = alt.trim().toLowerCase();
  if (!normalized) return true;

  const markers = [
    'intake',
    'testing',
    'photos',
    'photo',
    'original',
    'processed',
    'workflow',
  ];
  const markerCount = markers.reduce((count, marker) => count + (normalized.includes(marker) ? 1 : 0), 0);

  if (/\brec[a-z0-9]{8,}\b/i.test(normalized)) {
    return true;
  }

  if (markerCount >= 2) {
    return true;
  }

  if (markerCount >= 1 && /\b\d+\b/.test(normalized)) {
    return true;
  }

  return false;
}

function normalizeAltComparisonKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWorkflowAltToken(token: string): string {
  if (/^[a-z]{1,4}\d{2,5}$/i.test(token)) {
    const prefix = token.match(/^[a-z]+/i)?.[0] ?? '';
    const suffix = token.slice(prefix.length);
    return `${prefix.toUpperCase()}${suffix}`;
  }

  return `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`;
}

function buildWorkflowAltFromFilename(filename: string, url: string): string {
  const stem = extractFilenameStem(filename) || extractFilenameStem(url.split('/').pop() ?? '');
  if (!stem) return '';

  const rawTokens = stem
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^rec[a-z0-9]{8,}$/.test(token));

  if (rawTokens.length === 0) {
    return '';
  }

  return rawTokens.slice(0, 10).map((token) => formatWorkflowAltToken(token)).join(' ');
}

function resolveWorkflowAltText(rawAlt: string, filename: string, url: string, forceFilenameStructure = false): string {
  const fallbackAlt = buildWorkflowAltFromFilename(filename, url);

  if (forceFilenameStructure) {
    return fallbackAlt || rawAlt;
  }

  if (!rawAlt) {
    return fallbackAlt;
  }

  if (isLegacyWorkflowAltText(rawAlt)) {
    return fallbackAlt || rawAlt;
  }

  const fallbackWordCount = fallbackAlt.split(/\s+/).filter(Boolean).length;
  const rawWordCount = rawAlt.split(/\s+/).filter(Boolean).length;
  if (
    fallbackAlt
    && rawWordCount <= 2
    && fallbackWordCount >= 4
    && normalizeAltComparisonKey(rawAlt) !== normalizeAltComparisonKey(fallbackAlt)
  ) {
    return fallbackAlt;
  }

  return rawAlt;
}

function buildAltBackfillChanges(metadata: WorkflowImageMetadataRecord[], forceFilenameStructure = false): AltBackfillChange[] {
  const changes: AltBackfillChange[] = [];

  metadata.forEach((entry, index) => {
    const url = getString(entry.url);
    if (!url) {
      return;
    }

    const filename = extractFilename(url, entry.filename);
    const oldAlt = getString(entry.alt);
    const newAlt = resolveWorkflowAltText(oldAlt, filename, url, forceFilenameStructure);
    if (!newAlt || newAlt === oldAlt) {
      return;
    }

    changes.push({
      index,
      oldAlt,
      newAlt,
      filename,
      url,
    });
  });

  return changes;
}

async function loadRecords(recordIdFilter?: string): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: [
      'SKU',
      'Workflow Image Metadata JSON',
    ],
  });

  if (!recordIdFilter) {
    return records;
  }

  const filters = new Set(
    recordIdFilter
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean),
  );

  return records.filter((record) => filters.has(record.id));
}

async function runPlan(recordIdFilter?: string, forceFilenameStructure = false) {
  const runDir = createRunDirectory('plan');
  const records = await loadRecords(recordIdFilter);
  const planRows: Array<Record<string, unknown>> = [];

  records.forEach((record) => {
    const metadata = parseMetadata(record.fields['Workflow Image Metadata JSON']);
    const changes = buildAltBackfillChanges(metadata, forceFilenameStructure);
    if (changes.length === 0) {
      return;
    }

    changes.forEach((change) => {
      planRows.push({
        recordId: record.id,
        sku: getString(record.fields.SKU),
        index: change.index,
        filename: change.filename,
        oldAlt: change.oldAlt,
        newAlt: change.newAlt,
      });
    });
  });

  const summary = {
    createdAt: new Date().toISOString(),
    mode: 'plan',
    totalRecords: records.length,
    recordsWithChanges: new Set(planRows.map((row) => row.recordId)).size,
    altUpdates: planRows.length,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'alt-backfill-plan.json'), planRows);

  console.log(`Plan generated in ${runDir}`);
  console.log(`Records scanned: ${summary.totalRecords}`);
  console.log(`Records with alt updates: ${summary.recordsWithChanges}`);
  console.log(`Alt updates proposed: ${summary.altUpdates}`);
}

async function runApply(confirm: string, recordIdFilter?: string, forceFilenameStructure = false) {
  if (confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  const runDir = createRunDirectory('apply');
  const records = await loadRecords(recordIdFilter);
  const applyRows: Array<Record<string, unknown>> = [];

  for (const record of records) {
    const metadata = parseMetadata(record.fields['Workflow Image Metadata JSON']);
    const changes = buildAltBackfillChanges(metadata, forceFilenameStructure);
    if (changes.length === 0) {
      continue;
    }

    const nowIso = new Date().toISOString();
    changes.forEach((change) => {
      const target = metadata[change.index];
      if (!target) {
        return;
      }

      target.alt = change.newAlt;
      target.updatedAt = nowIso;

      applyRows.push({
        recordId: record.id,
        sku: getString(record.fields.SKU),
        index: change.index,
        filename: change.filename,
        oldAlt: change.oldAlt,
        newAlt: change.newAlt,
      });
    });

    await updateConfiguredRecord(
      'used-gear-workflow',
      record.id,
      {
        'Workflow Image Metadata JSON': serializeMetadata(metadata),
      },
      { typecast: true },
    );
  }

  const summary = {
    createdAt: new Date().toISOString(),
    mode: 'apply',
    recordsScanned: records.length,
    recordsUpdated: new Set(applyRows.map((row) => row.recordId)).size,
    altUpdatesApplied: applyRows.length,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'alt-backfill-apply.json'), applyRows);

  console.log(`Apply completed in ${runDir}`);
  console.log(`Records scanned: ${summary.recordsScanned}`);
  console.log(`Records updated: ${summary.recordsUpdated}`);
  console.log(`Alt updates applied: ${summary.altUpdatesApplied}`);
}

async function main() {
  setMergedEnv();
  const { command, options } = parseArgs(process.argv.slice(2));
  const recordIdFilter = options.record;
  const forceFilenameStructure = options.force === 'true';

  if (command === 'plan') {
    await runPlan(recordIdFilter, forceFilenameStructure);
    return;
  }

  if (command === 'apply') {
    await runApply(options.confirm ?? '', recordIdFilter, forceFilenameStructure);
    return;
  }

  throw new Error('Usage: node --import tsx scripts/backfill-workflow-image-alt-text.ts [plan|apply] [--record recId[,recId2]] [--force true] [--confirm TOKEN]');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
