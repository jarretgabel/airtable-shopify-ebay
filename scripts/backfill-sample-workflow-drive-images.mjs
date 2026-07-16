import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import { archiveWorkflowImagesToGoogleDrive } from '../aws/dist/providers/googleDrive/client.js';
import { getSubmission } from '../aws/dist/providers/jotform/client.js';
import { mapJotFormSubmissionToWorkflowItems } from '../aws/dist/providers/jotform/workflowIngestMapper.js';
import { archiveIntakeImagesForRecord } from '../aws/dist/providers/jotform/workflowIngest.js';

const BASE_ID = 'apprsAm2FOohEmL2u';
const TABLE_ID = 'tbl0K0nFQL64jQMx8';
const SAMPLE_MARKER = '[WORKFLOW_QUEUE_SAMPLE_DATA]';
const SAMPLE_SKU_PREFIX = 'SAMPLE-WORKFLOW-QUEUE-';
const TARGET_STATUSES = new Set([
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
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'sample-workflow-drive-backfill');
const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TESTING_AND_LATER_STATUSES = new Set([
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
const PHOTOGRAPHY_AND_LATER_STATUSES = new Set([
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

const jotFormSubmissionItemsCache = new Map();

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

let cachedDriveAccessToken = null;

async function getDriveAccessToken() {
  if (cachedDriveAccessToken) {
    return cachedDriveAccessToken;
  }

  const response = await fetch(GOOGLE_DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: requireEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: requireEnv('VITE_GOOGLE_DRIVE_REFRESH_TOKEN'),
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Google Drive token request failed: ${response.status} ${bodyText}`);
  }

  const body = bodyText ? JSON.parse(bodyText) : {};
  const token = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  if (!token) {
    throw new Error('Google Drive token response missing access token.');
  }

  cachedDriveAccessToken = token;
  return token;
}

async function driveJson(url, options = {}) {
  const token = await getDriveAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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

async function deleteDriveFile(fileId) {
  const token = await getDriveAccessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Drive file ${fileId}: ${response.status} ${await response.text()}`);
  }
}

async function listDriveFilesInFolder(folderId) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,size,mimeType)',
    pageSize: '200',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const body = await driveJson(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    method: 'GET',
  });
  return Array.isArray(body?.files) ? body.files : [];
}

function shouldDeleteLegacySampleDriveFile(fileName, sku) {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedSku = sku.trim().toLowerCase();
  if (!normalizedName.includes(normalizedSku)) {
    return false;
  }

  return normalizedName.endsWith('.png') || normalizedName.endsWith('.svg');
}

async function removeLegacySampleFiles(folderId, sku) {
  const files = await listDriveFilesInFolder(folderId);
  const legacyFiles = files.filter((file) => shouldDeleteLegacySampleDriveFile(String(file.name || ''), sku));
  for (const file of legacyFiles) {
    await deleteDriveFile(String(file.id));
  }
  return legacyFiles.map((file) => ({ id: file.id, name: file.name }));
}

function shouldDeleteUnexpectedSampleStageDriveFile(fileName, sku, allowedStages) {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedSku = sku.trim().toLowerCase();
  if (!normalizedName.includes(normalizedSku)) {
    return false;
  }

  const stagePrefixes = ['intake', 'testing', 'photos'];
  const matchedStage = stagePrefixes.find((stage) => normalizedName.startsWith(`${stage}--`));
  return Boolean(matchedStage && !allowedStages.has(matchedStage));
}

async function removeUnexpectedSampleStageFiles(folderId, sku, allowedStages) {
  const files = await listDriveFilesInFolder(folderId);
  const staleFiles = files.filter((file) => shouldDeleteUnexpectedSampleStageDriveFile(String(file.name || ''), sku, allowedStages));
  for (const file of staleFiles) {
    await deleteDriveFile(String(file.id));
  }
  return staleFiles.map((file) => ({ id: file.id, name: file.name }));
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

function getTrimmedString(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === 'string');
    return typeof firstString === 'string' ? firstString.trim() : '';
  }
  if (value && typeof value === 'object' && typeof value.text === 'string') {
    return value.text.trim();
  }
  return '';
}

function extractJotFormSubmissionId(slotSubmissionId) {
  const match = slotSubmissionId.match(/^(.+)-slot\d+$/);
  return match?.[1] ?? slotSubmissionId;
}

function isOldFormatSubmissionId(slotSubmissionId) {
  return !/-slot\d+$/.test(slotSubmissionId);
}

function isSampleRecord(record) {
  const fields = record.fields ?? {};
  const sku = getTrimmedString(fields.SKU);
  const skuLegacyBackup = getTrimmedString(fields['SKU Legacy Backup']);
  return [
    fields['Template Name'],
    fields['Item Title'],
    fields['Qualification Notes'],
    fields['Allocation Notes'],
    fields.Description,
  ].some((value) => getTrimmedString(value).includes(SAMPLE_MARKER))
    || sku.startsWith(SAMPLE_SKU_PREFIX)
    || skuLegacyBackup.startsWith(SAMPLE_SKU_PREFIX);
}

function getStagePlan(workflowStatus) {
  const metadataStages = ['intake'];
  let imageStage = null;

  if (TESTING_AND_LATER_STATUSES.has(workflowStatus)) {
    metadataStages.push('testing');
    imageStage = 'testing';
  }

  if (PHOTOGRAPHY_AND_LATER_STATUSES.has(workflowStatus)) {
    metadataStages.push('photos');
    imageStage = 'photos';
  }

  return {
    metadataStages,
    imageStage,
  };
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

function buildImageDescriptor(record, stage, index) {
  const sku = getTrimmedString(record.fields.SKU) || getTrimmedString(record.fields['SKU Legacy Backup']);
  const make = getTrimmedString(record.fields.Make).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const model = getTrimmedString(record.fields.Model).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const imageKey = sku || record.id;
  const stem = `${imageKey}-${make || 'item'}-${model || 'model'}-${stage}-${index}`.toLowerCase();
  const title = `${getTrimmedString(record.fields.Make)} ${getTrimmedString(record.fields.Model)}`.trim() || 'Sample Item';
  return {
    sku: imageKey,
    originalFilename: `${stem}-original.jpg`,
    processedFilename: `${stem}-processed.jpg`,
    alt: `${getTrimmedString(record.fields.Make)} ${getTrimmedString(record.fields.Model)} ${stage} sample image ${index}`.trim(),
    title,
    label: `${stage.toUpperCase()} SAMPLE ${index}`,
  };
}

async function renderSampleJpegBase64(descriptor, variant) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-sample-image-'));
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

async function archiveStageImages(record, stage) {
  const results = [];
  const isIntakeStage = stage === 'intake';
  for (let index = 1; index <= 3; index += 1) {
    const descriptor = buildImageDescriptor(record, stage, index);
    const originalFile = await renderSampleJpegBase64(descriptor, 'original');
    const processedFile = isIntakeStage
      ? originalFile
      : await renderSampleJpegBase64(descriptor, 'processed');

    const archive = await archiveWorkflowImagesToGoogleDrive({
      folderKey: record.id,
      stage,
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

    const timestamp = new Date().toISOString();
    results.push({
      folderId: archive.folderId,
      attachmentId: archive.original.id,
      url: archive.original.url,
      filename: archive.original.filename,
      alt: `${descriptor.alt} original`,
      sortOrder: results.length + 1,
      sourceStage: stage,
      includedInListing: stage !== 'intake',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    if (!isIntakeStage) {
      results.push({
        folderId: archive.folderId,
        attachmentId: archive.processed.id,
        url: archive.processed.url,
        filename: archive.processed.filename,
        alt: `${descriptor.alt} processed`,
        sortOrder: results.length + 1,
        sourceStage: stage,
        includedInListing: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  return results;
}

async function getJotFormSubmissionItems(slotSubmissionId) {
  const rootSubmissionId = extractJotFormSubmissionId(slotSubmissionId);
  if (!rootSubmissionId) {
    return [];
  }

  const cached = jotFormSubmissionItemsCache.get(rootSubmissionId);
  if (cached) {
    return cached;
  }

  const submission = await getSubmission(rootSubmissionId);
  const items = mapJotFormSubmissionToWorkflowItems(submission);
  jotFormSubmissionItemsCache.set(rootSubmissionId, items);
  return items;
}

async function archiveIntakeImages(record) {
  const slotSubmissionId = getTrimmedString(record.fields['JotForm Submission ID']);
  if (!slotSubmissionId) {
    return {
      source: 'seed',
      images: await archiveStageImages(record, 'intake'),
    };
  }

  try {
    const submissionItems = await getJotFormSubmissionItems(slotSubmissionId);
    const imageUrls = isOldFormatSubmissionId(slotSubmissionId)
      ? submissionItems.flatMap((item) => item.imageUrls)
      : (submissionItems.find((item) => item.submissionId === slotSubmissionId)?.imageUrls ?? []);

    if (imageUrls.length > 0) {
      const archivedFiles = await archiveIntakeImagesForRecord(record.id, imageUrls);
      const nowIso = new Date().toISOString();
      return {
        source: 'jotform',
        images: archivedFiles.map((file, index) => ({
          attachmentId: file.id,
          url: file.url,
          filename: file.filename,
          alt: '',
          sortOrder: index + 1,
          sourceStage: 'intake',
          includedInListing: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        })),
      };
    }
  } catch (error) {
    console.warn(`Falling back to seeded intake images for ${record.id}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    source: 'seed-fallback',
    images: await archiveStageImages(record, 'intake'),
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

async function updateRecord(apiKey, recordId, fields) {
  return fetchJson(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${recordId}`, apiKey, {
    method: 'PATCH',
    body: JSON.stringify({ fields, typecast: true }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ((args.confirm || '') !== 'BACKFILL_SAMPLE_WORKFLOW_DRIVE_IMAGES') {
    throw new Error('Run with --confirm BACKFILL_SAMPLE_WORKFLOW_DRIVE_IMAGES.');
  }

  setDriveEnv();
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const records = await fetchAllRecords(apiKey);
  const targetRecords = records.filter((record) => isSampleRecord(record) && TARGET_STATUSES.has(getTrimmedString(record.fields['Workflow Status'])));

  if (targetRecords.length === 0) {
    throw new Error('No sample workflow rows requiring Drive image backfill were found.');
  }

  const runDir = createRunDirectory();
  const results = [];

  for (const record of targetRecords) {
    const sku = getTrimmedString(record.fields.SKU) || getTrimmedString(record.fields['SKU Legacy Backup']);
    const workflowStatus = getTrimmedString(record.fields['Workflow Status']);
    const { metadataStages, imageStage } = getStagePlan(workflowStatus);
    const archivedByStage = {};

    for (const stage of metadataStages) {
      if (stage === 'intake') {
        archivedByStage.intake = (await archiveIntakeImages(record)).images;
        continue;
      }

      archivedByStage[stage] = await archiveStageImages(record, stage);
    }

    const intakeImages = archivedByStage.intake ?? [];
    const testingImages = archivedByStage.testing ?? [];
    const photoImages = archivedByStage.photos ?? [];
    const metadata = metadataStages.flatMap((stage) => archivedByStage[stage] ?? []);
    const currentStageImages = imageStage ? (archivedByStage[imageStage] ?? []) : [];
    const folderId = currentStageImages[0]?.folderId
      || intakeImages[0]?.folderId
      || testingImages[0]?.folderId
      || photoImages[0]?.folderId
      || null;
    const allowedStages = new Set(metadataStages);
    const deletedLegacyFiles = folderId && sku ? await removeLegacySampleFiles(folderId, sku) : [];
    const deletedUnexpectedStageFiles = folderId && sku ? await removeUnexpectedSampleStageFiles(folderId, sku, allowedStages) : [];
    const updated = await updateRecord(apiKey, record.id, {
      Images: currentStageImages.map((image) => ({ url: image.url, filename: image.filename })),
      'Workflow Image Metadata JSON': JSON.stringify(metadata),
    });

    results.push({
      recordId: record.id,
      itemTitle: getTrimmedString(record.fields['Item Title']),
      workflowStatus: getTrimmedString(record.fields['Workflow Status']),
      sku,
      folderId,
      intakeSource: getTrimmedString(record.fields['JotForm Submission ID']) ? 'jotform-or-fallback' : 'seed',
      intakeUrls: intakeImages.map((image) => image.url),
      photoUrls: photoImages.map((image) => image.url),
      testingUrls: testingImages.map((image) => image.url),
      deletedLegacyFiles,
      deletedUnexpectedStageFiles,
      updatedRecordId: updated.id,
    });
  }

  writeJson(path.join(runDir, 'summary.json'), {
    updatedAt: new Date().toISOString(),
    baseId: BASE_ID,
    tableId: TABLE_ID,
    updatedCount: results.length,
    results,
  });

  console.log(`Updated ${results.length} sample workflow row(s) with Drive-backed JPGs.`);
  console.log(`Artifacts saved in ${runDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});