/**
 * One-time backfill: archive JotForm intake images to Google Drive for all
 * existing Airtable workflow records that have a JotForm Submission ID but no
 * intake-stage images in Workflow Image Metadata JSON.
 *
 * Usage:
 *   node --import tsx scripts/backfill-jotform-intake-images.ts
 *   node --import tsx scripts/backfill-jotform-intake-images.ts --force
 *
 * Flags:
 *   --force   Re-process records that already have intake images archived.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { backfillIntakeImages } from '../aws/src/providers/jotform/workflowBackfill.ts';

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

function getEnv(name: string): string {
  return mergedEnv[name]?.trim() ?? '';
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Map VITE_-prefixed vars to the names the Lambda providers expect.
process.env.JOTFORM_API_KEY = requireEnv('VITE_JOTFORM_API_KEY');
process.env.AIRTABLE_API_KEY = requireEnv('VITE_AIRTABLE_API_KEY');
process.env.AIRTABLE_BASE_ID = requireEnv('VITE_AIRTABLE_BASE_ID');
process.env.ALLOWED_AIRTABLE_TABLE_NAME = requireEnv('VITE_AIRTABLE_TABLE_NAME');
process.env.AIRTABLE_USERS_TABLE_REF = getEnv('VITE_AIRTABLE_USERS_TABLE_REF');
process.env.AIRTABLE_USERS_TABLE_NAME = getEnv('VITE_AIRTABLE_USERS_TABLE_NAME');
process.env.AIRTABLE_USER_GUIDE_TABLE_REF = getEnv('VITE_AIRTABLE_USER_GUIDE_TABLE_REF');
process.env.AIRTABLE_USER_GUIDE_TABLE_NAME = getEnv('VITE_AIRTABLE_USER_GUIDE_TABLE_NAME');
process.env.AIRTABLE_APPROVAL_TABLE_REF = getEnv('VITE_AIRTABLE_APPROVAL_TABLE_REF');
process.env.AIRTABLE_APPROVAL_TABLE_NAME = getEnv('VITE_AIRTABLE_APPROVAL_TABLE_NAME');
process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF = getEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF');
process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME = getEnv('VITE_AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME');
process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF = getEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_REF');
process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME = getEnv('VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME');
process.env.GOOGLE_DRIVE_CLIENT_ID = getEnv('VITE_GOOGLE_DRIVE_CLIENT_ID');
process.env.GOOGLE_DRIVE_CLIENT_SECRET = getEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET');
process.env.GOOGLE_DRIVE_REFRESH_TOKEN = getEnv('VITE_GOOGLE_DRIVE_REFRESH_TOKEN');
process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = getEnv('VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID');

// ── run ────────────────────────────────────────────────────────────────────────

const force = process.argv.includes('--force');

console.log(`\nJotForm intake image backfill`);
console.log(`  force: ${force}`);
console.log('');

const result = await backfillIntakeImages({ skipIfAlreadyBackfilled: !force });

console.log(`\nResults:`);
console.log(`  Total records processed: ${result.total}`);
console.log(`  Backfilled:              ${result.backfilled}`);
console.log(`  No images (skipped):     ${result.noImages}`);
console.log(`  Already backfilled:      ${result.skipped}`);
console.log(`  Failed:                  ${result.failed}`);

if (result.results.length > 0) {
  console.log('\nPer-record detail:');
  for (const r of result.results) {
    const label = r.action === 'backfilled'
      ? `✓ backfilled (${r.imageCount} images)`
      : r.action === 'no_images'
        ? '- no images found in JotForm'
        : r.action === 'skipped'
          ? '- already backfilled'
          : `✗ failed: ${r.error ?? 'unknown error'}`;
    console.log(`  [${r.recordId}] ${r.slotSubmissionId} → ${label}`);
  }
}

if (result.failed > 0) {
  process.exit(1);
}
