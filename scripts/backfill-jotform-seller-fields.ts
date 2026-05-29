/**
 * Backfills missing seller contact and item-condition fields on existing
 * JotForm-sourced Airtable records.
 *
 * Fields backfilled (only when currently empty):
 *   Seller Email, Seller Phone, Seller Zip Code, Seller Location,
 *   How Did You Hear, Mailing List Opt In, Original Owner, Smoke Exposure,
 *   Customer Cosmetic Notes, Customer Functional Notes
 *
 * Usage:
 *   npm run jotform:backfill-fields:plan
 *   npm run jotform:backfill-fields:apply -- --confirm BACKFILL_JOTFORM_SELLER_FIELDS
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { getSubmission } from '../aws/src/providers/jotform/client.ts';
import { mapJotFormSubmissionToWorkflowItems } from '../aws/src/providers/jotform/workflowIngestMapper.ts';

const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const DEFAULT_BASE_ID = 'apprsAm2FOohEmL2u';
const DEFAULT_TABLE_ID = 'tbl0K0nFQL64jQMx8';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'jotform-seller-fields-backfill');
const APPLY_CONFIRM_TOKEN = 'BACKFILL_JOTFORM_SELLER_FIELDS';
const AIRTABLE_PATCH_BATCH = 10;

/** Fields written to Airtable during backfill — skipped if already set. */
const BACKFILL_FIELDS = [
  'Seller Email',
  'Seller Phone',
  'Seller Zip Code',
  'Seller Location',
  'How Did You Hear',
  'Mailing List Opt In',
  'Original Owner',
  'Smoke Exposure',
  'Customer Cosmetic Notes',
  'Customer Functional Notes',
] as const;

// ── env setup ──────────────────────────────────────────────────────────────────

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv: Record<string, string> = {
  ...readEnvFile(path.join(process.cwd(), '.env')),
  ...readEnvFile(path.join(process.cwd(), '.env.local')),
  ...(process.env as Record<string, string>),
};

for (const [key, value] of Object.entries(mergedEnv)) {
  if (typeof value === 'string' && !(key in process.env)) {
    process.env[key] = value;
  }
}

if (!process.env.JOTFORM_API_KEY && typeof mergedEnv.VITE_JOTFORM_API_KEY === 'string' && mergedEnv.VITE_JOTFORM_API_KEY.trim()) {
  process.env.JOTFORM_API_KEY = mergedEnv.VITE_JOTFORM_API_KEY.trim();
}

function getEnv(name: string): string {
  const v = mergedEnv[name];
  return typeof v === 'string' ? v.trim() : '';
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// ── utilities ──────────────────────────────────────────────────────────────────

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
  const [command = 'help', ...rest] = argv;
  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) { options[key] = 'true'; continue; }
    options[key] = next;
    i++;
  }
  return { command, options };
}

function isMissingValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Parse a JotForm Submission ID into its base submission ID and slot index.
 * New format: "5703456789-slot2"  → { baseId: "5703456789", slotIndex: 2 }
 * Old format: "5703456789"        → { baseId: "5703456789", slotIndex: null }
 * (Records ingested before multi-slot tracking store only the raw submission ID.)
 */
function parseSlotSubmissionId(slotId: string): { baseId: string; slotIndex: number | null } {
  const match = slotId.match(/^(.+)-slot(\d+)$/);
  if (match) return { baseId: match[1], slotIndex: parseInt(match[2], 10) };
  return { baseId: slotId, slotIndex: null };
}

/** Fields that vary per-slot; all others are shared across every slot in a submission. */
const PER_SLOT_FIELDS = new Set([
  'Original Owner',
  'Smoke Exposure',
  'Customer Cosmetic Notes',
  'Customer Functional Notes',
]);

// ── Airtable ───────────────────────────────────────────────────────────────────

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchJotFormRecords(baseId: string, tableId: string, apiKey: string): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  const queryFields: string[] = ['JotForm Submission ID', ...BACKFILL_FIELDS];

  do {
    const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${tableId}`);
    url.searchParams.set('filterByFormula', '{Workflow Source}="JotForm"');
    for (const field of queryFields) url.searchParams.append('fields[]', field);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) throw new Error(`Airtable list error: HTTP ${response.status}`);

    const body = await response.json() as { records: AirtableRecord[]; offset?: string };
    all.push(...body.records);
    offset = body.offset;
  } while (offset);

  return all;
}

async function patchAirtableRecords(
  baseId: string,
  tableId: string,
  apiKey: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<void> {
  for (let i = 0; i < updates.length; i += AIRTABLE_PATCH_BATCH) {
    const batch = updates.slice(i, i + AIRTABLE_PATCH_BATCH);
    const response = await fetch(`${AIRTABLE_API_BASE}/${baseId}/${tableId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: batch, typecast: true }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Airtable PATCH error: HTTP ${response.status}: ${text}`);
    }
  }
}

// ── backfill logic ─────────────────────────────────────────────────────────────

interface BackfillCandidate {
  recordId: string;
  slotSubmissionId: string;
  baseSubmissionId: string;
  /** null for old-format records that store only the raw submission ID. */
  slotIndex: number | null;
  missingFields: string[];
}

interface BackfillUpdate {
  recordId: string;
  slotSubmissionId: string;
  patchFields: Record<string, unknown>;
}

function buildCandidates(records: AirtableRecord[]): BackfillCandidate[] {
  const candidates: BackfillCandidate[] = [];

  for (const record of records) {
    const slotSubmissionId = typeof record.fields['JotForm Submission ID'] === 'string'
      ? record.fields['JotForm Submission ID']
      : '';

    if (!slotSubmissionId) continue;

    const { baseId: baseSubmissionId, slotIndex } = parseSlotSubmissionId(slotSubmissionId);

    const missingFields = BACKFILL_FIELDS.filter((f) => isMissingValue(record.fields[f]));
    if (missingFields.length === 0) continue;

    candidates.push({
      recordId: record.id,
      slotSubmissionId,
      baseSubmissionId,
      slotIndex,
      missingFields,
    });
  }

  return candidates;
}

async function resolveUpdates(candidates: BackfillCandidate[]): Promise<BackfillUpdate[]> {
  // Cache submissions — multiple Airtable rows may share the same JotForm submission.
  const submissionCache = new Map<string, Awaited<ReturnType<typeof getSubmission>>>();

  const fetchCached = async (baseSubmissionId: string) => {
    if (submissionCache.has(baseSubmissionId)) return submissionCache.get(baseSubmissionId)!;
    const submission = await getSubmission(baseSubmissionId);
    submissionCache.set(baseSubmissionId, submission);
    return submission;
  };

  const updates: BackfillUpdate[] = [];

  for (const candidate of candidates) {
    try {
      const submission = await fetchCached(candidate.baseSubmissionId);
      const items = mapJotFormSubmissionToWorkflowItems(submission);

      // For slot-specific IDs find the exact item; for raw IDs use the first item
      // for shared fields (all items carry the same shared values) and only fill
      // per-slot fields when there is a single active slot (no ambiguity).
      const exactMatch = items.find((item) => item.submissionId === candidate.slotSubmissionId);
      const sharedSource = exactMatch ?? items[0];

      if (!sharedSource) {
        console.warn(`  ⚠ No active slots found for submission ${candidate.baseSubmissionId}`);
        continue;
      }

      const patchFields: Record<string, unknown> = {};
      for (const fieldName of candidate.missingFields) {
        // Per-slot fields require an exact slot match or a single-slot submission.
        if (PER_SLOT_FIELDS.has(fieldName) && !exactMatch && items.length !== 1) continue;
        const value = sharedSource.airtableFields[fieldName];
        if (value !== undefined && value !== null && value !== '') {
          patchFields[fieldName] = value;
        }
      }

      if (Object.keys(patchFields).length > 0) {
        updates.push({ recordId: candidate.recordId, slotSubmissionId: candidate.slotSubmissionId, patchFields });
      }
    } catch (error) {
      console.warn(`  ⚠ Skipping ${candidate.baseSubmissionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return updates;
}

// ── commands ───────────────────────────────────────────────────────────────────

async function runPlan(baseId: string, tableId: string, apiKey: string): Promise<void> {
  const runDir = createRunDirectory('plan');
  console.log('Fetching JotForm records from Airtable…');
  const records = await fetchJotFormRecords(baseId, tableId, apiKey);
  console.log(`Found ${records.length} JotForm-sourced record(s).`);

  const candidates = buildCandidates(records);
  console.log(`${candidates.length} record(s) have at least one missing seller field.`);

  if (candidates.length > 0) {
    console.log('Resolving JotForm submissions to determine available data…');
    const updates = await resolveUpdates(candidates);
    console.log(`${updates.length} record(s) have data available to backfill.`);

    const preview = updates.slice(0, 15);
    for (const u of preview) {
      console.log(`  ${u.recordId}  (${u.slotSubmissionId})  →  ${Object.keys(u.patchFields).join(', ')}`);
    }
    if (updates.length > 15) console.log(`  … and ${updates.length - 15} more`);

    writeJson(path.join(runDir, 'updates.json'), updates);
  }

  writeJson(path.join(runDir, 'candidates.json'), candidates);
  console.log(`Plan output: ${runDir}`);
}

async function runApply(baseId: string, tableId: string, apiKey: string, confirm: string): Promise<void> {
  if (confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  const runDir = createRunDirectory('apply');
  console.log('Fetching JotForm records from Airtable…');
  const records = await fetchJotFormRecords(baseId, tableId, apiKey);
  console.log(`Found ${records.length} JotForm-sourced record(s).`);

  const candidates = buildCandidates(records);
  console.log(`${candidates.length} record(s) have at least one missing seller field.`);

  if (candidates.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  console.log('Resolving JotForm submissions…');
  const updates = await resolveUpdates(candidates);
  console.log(`Patching ${updates.length} Airtable record(s)…`);

  await patchAirtableRecords(
    baseId,
    tableId,
    apiKey,
    updates.map((u) => ({ id: u.recordId, fields: u.patchFields })),
  );

  const summary = {
    baseId,
    tableId,
    totalJotFormRecords: records.length,
    candidateCount: candidates.length,
    updatedCount: updates.length,
    updates: updates.map((u) => ({
      recordId: u.recordId,
      slotSubmissionId: u.slotSubmissionId,
      fields: Object.keys(u.patchFields),
    })),
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'updates.json'), updates);
  console.log(`Done. Updated ${updates.length} record(s).`);
  console.log(`Apply output: ${runDir}`);
}

function printHelp(): void {
  console.log('JotForm seller fields backfill');
  console.log('');
  console.log('Backfills missing seller contact and item-condition fields on existing');
  console.log('JotForm-sourced Airtable records by re-reading the original JotForm submissions.');
  console.log('');
  console.log('Fields: Seller Email, Seller Phone, Seller Zip Code, Seller Location,');
  console.log('        How Did You Hear, Mailing List Opt In, Original Owner, Smoke Exposure');
  console.log('');
  console.log('Commands:');
  console.log('  plan');
  console.log('    Show which records would be updated and what data is available.');
  console.log('');
  console.log(`  apply --confirm ${APPLY_CONFIRM_TOKEN}`);
  console.log('    Fetch missing values from JotForm and patch the Airtable records.');
  console.log('');
  console.log('Options:');
  console.log('  --base-id   Airtable base ID  (default: VITE_AIRTABLE_BASE_ID env var)');
  console.log('  --table-id  Airtable table ID (default: tbl0K0nFQL64jQMx8)');
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const apiKey = getEnv('VITE_AIRTABLE_API_KEY') || requireEnv('AIRTABLE_API_KEY');
  const baseId = options['base-id'] || getEnv('VITE_AIRTABLE_BASE_ID') || DEFAULT_BASE_ID;
  const tableId = options['table-id'] || DEFAULT_TABLE_ID;

  if (command === 'plan') {
    await runPlan(baseId, tableId, apiKey);
    return;
  }

  if (command === 'apply') {
    await runApply(baseId, tableId, apiKey, options.confirm ?? '');
    return;
  }

  printHelp();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
