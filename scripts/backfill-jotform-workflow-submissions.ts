import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { getFormSubmissions, type JotFormSubmission } from '../aws/src/providers/jotform/client.ts';
import { createIngestJotFormSubmissionWorkflow } from '../aws/src/providers/jotform/workflowIngest.ts';

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'jotform-workflow-backfill');
const DEFAULT_DAYS = 7;
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;
const APPLY_CONFIRM_TOKEN = 'BACKFILL_JOTFORM_WORKFLOW_SUBMISSIONS';

function readEnvFile(filePath: string): Record<string, string> {
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

for (const [key, value] of Object.entries(mergedEnv)) {
  if (typeof value === 'string' && !(key in process.env)) {
    process.env[key] = value;
  }
}

if (!process.env.JOTFORM_API_KEY && typeof mergedEnv.VITE_JOTFORM_API_KEY === 'string' && mergedEnv.VITE_JOTFORM_API_KEY.trim()) {
  process.env.JOTFORM_API_KEY = mergedEnv.VITE_JOTFORM_API_KEY.trim();
}

if (!process.env.AIRTABLE_API_KEY && typeof mergedEnv.VITE_AIRTABLE_API_KEY === 'string' && mergedEnv.VITE_AIRTABLE_API_KEY.trim()) {
  process.env.AIRTABLE_API_KEY = mergedEnv.VITE_AIRTABLE_API_KEY.trim();
}

if (!process.env.AIRTABLE_BASE_ID && typeof mergedEnv.VITE_AIRTABLE_BASE_ID === 'string' && mergedEnv.VITE_AIRTABLE_BASE_ID.trim()) {
  process.env.AIRTABLE_BASE_ID = mergedEnv.VITE_AIRTABLE_BASE_ID.trim();
}

function getEnv(name: string): string {
  const value = mergedEnv[name];
  return typeof value === 'string' ? value.trim() : '';
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
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

function printHelp(): void {
  console.log('JotForm workflow backfill helper');
  console.log('');
  console.log('Commands:');
  console.log('  plan [--days 7] [--form-id 123456789] [--page-size 100] [--max-pages 20]');
  console.log('    Find recent JotForm submissions that would be replayed through the workflow ingest path.');
  console.log('');
  console.log(`  apply --confirm ${APPLY_CONFIRM_TOKEN} [--days 7] [--form-id 123456789] [--page-size 100] [--max-pages 20]`);
  console.log('    Replay recent JotForm submissions through the same ingest provider used by the webhook.');
  console.log('');
  console.log('Environment:');
  console.log('  VITE_JOTFORM_FORM_ID is used by default when --form-id is omitted.');
  console.log('  JOTFORM_API_KEY, VITE_AIRTABLE_API_KEY, and Google Drive archive env vars must be available when applying.');
}

function parseArgs(argv: string[]): { command: string; options: Record<string, string> } {
  const [command = 'help', ...rest] = argv;
  const options: Record<string, string> = {};

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

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJotFormDate(value: string): number {
  const normalized = value.trim();
  if (!normalized) {
    return Number.NaN;
  }

  const isoLike = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  return Date.parse(isoLike);
}

async function loadRecentSubmissions(formId: string, days: number, pageSize: number, maxPages: number): Promise<JotFormSubmission[]> {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  const collected: JotFormSubmission[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const batch = await getFormSubmissions(formId, {
      limit: pageSize,
      offset: page * pageSize,
      orderby: 'created_at',
      direction: 'DESC',
    });

    if (batch.length === 0) {
      break;
    }

    const activeRecent = batch.filter((submission) => {
      if (submission.status !== 'ACTIVE') {
        return false;
      }

      const createdAt = parseJotFormDate(submission.created_at);
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    });
    collected.push(...activeRecent);

    const oldestTimestamp = Math.min(...batch.map((submission) => parseJotFormDate(submission.created_at)).filter(Number.isFinite));
    if (!Number.isFinite(oldestTimestamp) || oldestTimestamp < cutoff) {
      break;
    }
  }

  const deduped = new Map<string, JotFormSubmission>();
  collected.forEach((submission) => {
    deduped.set(submission.id, submission);
  });

  return [...deduped.values()].sort((left, right) => parseJotFormDate(right.created_at) - parseJotFormDate(left.created_at));
}

async function runPlan(formId: string, days: number, pageSize: number, maxPages: number): Promise<void> {
  const runDir = createRunDirectory('plan');
  const submissions = await loadRecentSubmissions(formId, days, pageSize, maxPages);
  const summary = {
    formId,
    days,
    pageSize,
    maxPages,
    candidateCount: submissions.length,
    submissionIds: submissions.map((submission) => submission.id),
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'submissions.json'), submissions.map((submission) => ({
    id: submission.id,
    created_at: submission.created_at,
    status: submission.status,
    form_id: submission.form_id,
  })));

  console.log(`Found ${submissions.length} active JotForm submission(s) from the last ${days} day(s).`);
  console.log(`Plan output: ${runDir}`);
}

async function runApply(formId: string, days: number, pageSize: number, maxPages: number, confirm: string): Promise<void> {
  if (confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  const runDir = createRunDirectory('apply');
  const submissions = await loadRecentSubmissions(formId, days, pageSize, maxPages);
  const ingestSubmission = createIngestJotFormSubmissionWorkflow();
  const results = [] as Array<Awaited<ReturnType<typeof ingestSubmission>>>;

  for (const submission of submissions) {
    const result = await ingestSubmission(formId, submission.id);
    results.push(result);
  }

  const flattenedItems = results.flatMap((result) => result.items);
  const summary = {
    formId,
    days,
    pageSize,
    maxPages,
    processedSubmissionCount: results.length,
    createdCount: flattenedItems.filter((item) => item.action === 'created').length,
    updatedCount: flattenedItems.filter((item) => item.action === 'updated').length,
    skippedCount: flattenedItems.filter((item) => item.action === 'skipped').length,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  writeJson(path.join(runDir, 'results.json'), results);

  console.log(`Processed ${results.length} JotForm submission(s).`);
  console.log(`Created ${summary.createdCount}, updated ${summary.updatedCount}, skipped ${summary.skippedCount} workflow row(s).`);
  console.log(`Apply output: ${runDir}`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  const formId = options['form-id'] || requireEnv('VITE_JOTFORM_FORM_ID');
  const days = parsePositiveInt(options.days, DEFAULT_DAYS);
  const pageSize = parsePositiveInt(options['page-size'], DEFAULT_PAGE_SIZE);
  const maxPages = parsePositiveInt(options['max-pages'], DEFAULT_MAX_PAGES);

  if (command === 'plan') {
    await runPlan(formId, days, pageSize, maxPages);
    return;
  }

  if (command === 'apply') {
    await runApply(formId, days, pageSize, maxPages, options.confirm ?? '');
    return;
  }

  printHelp();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});