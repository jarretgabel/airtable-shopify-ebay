import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { archiveWorkflowImagesToGoogleDrive } from '../aws/dist/providers/googleDrive/client.js';

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tbl0K0nFQL64jQMx8';
const SAMPLE_MARKER = '[COMBINED_LISTINGS_SAMPLE_DATA]';
const SAMPLE_SKU_PREFIX = 'SAMPLE-LISTING-';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'approval-combined-samples-drive-backfill');

function loadEnv() {
  let merged = { ...process.env };
  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      merged = { ...dotenv.parse(fs.readFileSync(filePath, 'utf8')), ...merged };
    }
  }
  return merged;
}

const env = loadEnv();

function getEnv(name) {
  const value = env[name]?.trim();
  return value || '';
}

function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function setDriveEnv() {
  process.env.GOOGLE_DRIVE_CLIENT_ID = requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID');
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = requireEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET');
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = requireEnv('VITE_GOOGLE_DRIVE_REFRESH_TOKEN');
  process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = requireEnv('VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID');
}

function getTrimmedString(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .find(Boolean) || '';
  }

  return '';
}

function splitCommaSeparatedValues(value) {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stripSampleMarker(value) {
  return value.replace(SAMPLE_MARKER, '').trim();
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'sample-item';
}

function createRunDirectory() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `run-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isSampleRecord(record) {
  const fields = record.fields ?? {};
  return [
    fields['Template Name'],
    fields['Item Title'],
    fields.Description,
  ].some((value) => getTrimmedString(value).includes(SAMPLE_MARKER))
    || getTrimmedString(fields.SKU).startsWith(SAMPLE_SKU_PREFIX);
}

async function fetchJson(url, apiKey, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;
  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `${response.status} ${response.statusText}`);
  }

  return body;
}

async function fetchAllRecords(apiKey) {
  const records = [];
  let offset = '';

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const payload = await fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params.toString()}`, apiKey);
    records.push(...(payload.records || []));
    offset = payload.offset || '';
  } while (offset);

  return records;
}

async function updateRecord(apiKey, recordId, fields) {
  return fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ fields, typecast: true }),
  });
}

function resolveSampleTitle(record) {
  const rawTitle = getTrimmedString(record.fields?.['Item Title'])
    || getTrimmedString(record.fields?.['Template Name'])
    || 'Combined Listing Sample';

  return stripSampleMarker(rawTitle) || 'Combined Listing Sample';
}

function resolveSku(record) {
  return getTrimmedString(record.fields?.SKU);
}

function resolveAltTexts(record) {
  const altTexts = splitCommaSeparatedValues(getTrimmedString(record.fields?.['Images Alt Text (comma separated)']));
  const existingImageCount = [
    ...splitCommaSeparatedValues(getTrimmedString(record.fields?.['Images (comma-separated)'])),
    ...splitCommaSeparatedValues(getTrimmedString(record.fields?.['Images (comma-separated) 2'])),
  ].length;
  const imageCount = Math.max(altTexts.length, existingImageCount, 1);

  return Array.from({ length: imageCount }, (_, index) => altTexts[index] || `${resolveSampleTitle(record)} sample image ${index + 1}`);
}

function buildImageDescriptor(record, index, altTexts) {
  const sku = resolveSku(record);
  if (!sku) {
    throw new Error(`Record ${record.id} is missing SKU.`);
  }

  const title = resolveSampleTitle(record);
  const stem = `${sku}-${slugify(title)}-${String(index).padStart(2, '0')}`;

  return {
    sku,
    title,
    alt: altTexts[index - 1],
    label: `LISTING SAMPLE ${index}`,
    originalFilename: `${stem}-original.jpg`,
    processedFilename: `${stem}-processed.jpg`,
  };
}

function renderSampleJpegBase64(descriptor, variant) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-listing-sample-image-'));
  const outputPath = path.join(tempDir, `${variant}.jpg`);

  try {
    execFileSync('swift', [
      path.join(process.cwd(), 'scripts/render-sample-workflow-image.swift'),
      '--output', outputPath,
      '--variant', variant,
      '--title', descriptor.title,
      '--label', descriptor.label,
      '--sku', descriptor.sku,
    ], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    return fs.readFileSync(outputPath).toString('base64');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function archiveSampleImages(record) {
  const altTexts = resolveAltTexts(record);
  const archivedImages = [];

  for (let index = 1; index <= altTexts.length; index += 1) {
    const descriptor = buildImageDescriptor(record, index, altTexts);
    const originalFile = renderSampleJpegBase64(descriptor, 'original');
    const processedFile = renderSampleJpegBase64(descriptor, 'processed');

    const archive = await archiveWorkflowImagesToGoogleDrive({
      sku: descriptor.sku,
      stage: 'photos',
      original: {
        filename: descriptor.originalFilename,
        contentType: 'image/jpeg',
        file: originalFile,
      },
      processed: {
        filename: descriptor.processedFilename,
        contentType: 'image/jpeg',
        file: processedFile,
      },
    });

    archivedImages.push({
      id: archive.processed.id,
      url: archive.processed.url,
      filename: archive.processed.filename,
      alt: descriptor.alt,
    });
  }

  return archivedImages;
}

export async function backfillCombinedListingSampleDriveImages(options = {}) {
  const apiKey = options.apiKey || requireEnv('VITE_AIRTABLE_API_KEY');
  const normalizedRecordIds = Array.isArray(options.recordIds)
    ? options.recordIds.map((recordId) => String(recordId).trim()).filter(Boolean)
    : [];
  const requestedRecordIds = normalizedRecordIds.length > 0
    ? new Set(normalizedRecordIds)
    : null;

  setDriveEnv();

  const allRecords = Array.isArray(options.records) && options.records.length > 0
    ? options.records
    : await fetchAllRecords(apiKey);
  const targetRecords = allRecords
    .filter(isSampleRecord)
    .filter((record) => !requestedRecordIds || requestedRecordIds.has(String(record.id)));

  if (targetRecords.length === 0) {
    throw new Error('No combined listing sample rows were found for Drive image backfill.');
  }

  const runDir = createRunDirectory();
  const results = [];

  for (const record of targetRecords) {
    const archivedImages = await archiveSampleImages(record);
    const primaryUrls = archivedImages.slice(0, 2).map((image) => image.url);
    const secondaryUrls = archivedImages.slice(2).map((image) => image.url);
    const updated = await updateRecord(apiKey, record.id, {
      'Images (comma-separated)': primaryUrls.join(', '),
      'Images (comma-separated) 2': secondaryUrls.join(', '),
    });

    results.push({
      recordId: record.id,
      itemTitle: resolveSampleTitle(record),
      sku: resolveSku(record),
      updatedRecordId: updated.id,
      imageCount: archivedImages.length,
      primaryUrls,
      secondaryUrls,
    });
  }

  writeJson(path.join(runDir, 'summary.json'), {
    updatedAt: new Date().toISOString(),
    baseId: BASE_ID,
    tableId: TABLE_ID,
    updatedCount: results.length,
    results,
  });

  console.log(`Updated ${results.length} combined listing sample row(s) with Drive-backed images.`);
  console.log(`Artifacts saved in ${runDir}`);

  return {
    runDir,
    updatedCount: results.length,
    results,
  };
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      args[key] = 'true';
      continue;
    }

    args[key] = nextToken;
    index += 1;
  }

  return args;
}

function printHelp() {
  console.log('Backfill Drive-backed combined listing sample images');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/backfill-approval-combined-sample-drive-images.mjs --confirm BACKFILL_COMBINED_LISTING_SAMPLE_DRIVE_IMAGES [--record-ids rec1,rec2]');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ((args.confirm || '') !== 'BACKFILL_COMBINED_LISTING_SAMPLE_DRIVE_IMAGES') {
    printHelp();
    throw new Error('Run with --confirm BACKFILL_COMBINED_LISTING_SAMPLE_DRIVE_IMAGES.');
  }

  const recordIds = typeof args['record-ids'] === 'string'
    ? args['record-ids'].split(',').map((recordId) => recordId.trim()).filter(Boolean)
    : [];

  await backfillCombinedListingSampleDriveImages({ recordIds });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}