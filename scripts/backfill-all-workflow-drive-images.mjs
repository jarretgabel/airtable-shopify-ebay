import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import dotenv from 'dotenv';
import { archiveWorkflowImagesToGoogleDrive } from '../aws/dist/providers/googleDrive/client.js';
import { getConfiguredRecords, updateConfiguredRecord } from '../aws/dist/providers/airtable/sources.js';
import { getSubmission } from '../aws/dist/providers/jotform/client.js';
import { mapJotFormSubmissionToWorkflowItems } from '../aws/dist/providers/jotform/workflowIngestMapper.js';
import {
  archiveIntakeImagesForRecord,
  parseWorkflowImageMetadata,
  replaceIntakeImageMetadata,
  serializeWorkflowImageMetadata,
} from '../aws/dist/providers/jotform/workflowIngest.js';

const RUNS_DIR = path.join(process.cwd(), 'tmp', 'workflow-drive-backfill-all');
const APPLY_CONFIRM_TOKEN = 'BACKFILL_ALL_WORKFLOW_DRIVE_IMAGES';
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

function setProviderEnv() {
  process.env.AIRTABLE_API_KEY = requireEnv('VITE_AIRTABLE_API_KEY');
  process.env.AIRTABLE_BASE_ID = requireEnv('VITE_AIRTABLE_BASE_ID');
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
  process.env.GOOGLE_DRIVE_CLIENT_ID = requireEnv('VITE_GOOGLE_DRIVE_CLIENT_ID');
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = requireEnv('VITE_GOOGLE_DRIVE_CLIENT_SECRET');
  process.env.GOOGLE_DRIVE_REFRESH_TOKEN = requireEnv('VITE_GOOGLE_DRIVE_REFRESH_TOKEN');
  process.env.GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID = requireEnv('VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID');
  const jotFormApiKey = getEnv('VITE_JOTFORM_API_KEY');
  if (jotFormApiKey) {
    process.env.JOTFORM_API_KEY = jotFormApiKey;
  }
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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function logProgress(message, details = undefined) {
  const prefix = `[workflow-drive-backfill] ${new Date().toISOString()}`;
  if (!details) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`, details);
}

function createRunDirectory(mode) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `${mode}-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
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

  return { metadataStages, imageStage };
}

function buildImageDescriptor(record, stage, index) {
  const sku = getTrimmedString(record.fields.SKU) || getTrimmedString(record.fields['SKU Legacy Backup']);
  const make = getTrimmedString(record.fields.Make).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const model = getTrimmedString(record.fields.Model).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const imageKey = sku || record.id;
  const stem = `${imageKey}-${make || 'item'}-${model || 'model'}-${stage}-${index}`.toLowerCase();
  const title = `${getTrimmedString(record.fields.Make)} ${getTrimmedString(record.fields.Model)}`.trim() || 'Workflow Item';
  return {
    key: imageKey,
    originalFilename: `${stem}-original.jpg`,
    processedFilename: `${stem}-processed.jpg`,
    alt: `${getTrimmedString(record.fields.Make)} ${getTrimmedString(record.fields.Model)} ${stage} image ${index}`.trim(),
    title,
    label: `${stage.toUpperCase()} ${index}`,
  };
}

async function renderSampleJpegBase64(descriptor, variant) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-stage-image-'));
  const outputPath = path.join(tempDir, `${variant}.jpg`);

  try {
    execFileSync('swift', [
      path.join(process.cwd(), 'scripts/render-sample-workflow-image.swift'),
      '--output', outputPath,
      '--variant', variant,
      '--title', descriptor.title,
      '--label', descriptor.label,
      '--sku', descriptor.key,
    ], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    return fs.readFileSync(outputPath).toString('base64');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function archiveSeededStageImages(record, stage) {
  const results = [];
  for (let index = 1; index <= 3; index += 1) {
    const descriptor = buildImageDescriptor(record, stage, index);
    const originalFile = await renderSampleJpegBase64(descriptor, 'original');
    const processedFile = await renderSampleJpegBase64(descriptor, 'processed');
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
    results.push({
      attachmentId: archive.processed.id,
      url: archive.processed.url,
      filename: archive.processed.filename,
      alt: `${descriptor.alt} processed`,
      sortOrder: results.length + 1,
      sourceStage: stage,
      includedInListing: stage !== 'intake',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
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
    logProgress(`Using cached JotForm submission ${rootSubmissionId}.`);
    return cached;
  }

  logProgress(`Fetching JotForm submission ${rootSubmissionId}.`);
  const submission = await getSubmission(rootSubmissionId);
  const items = mapJotFormSubmissionToWorkflowItems(submission);
  jotFormSubmissionItemsCache.set(rootSubmissionId, items);
  logProgress(`Mapped JotForm submission ${rootSubmissionId} into ${items.length} workflow item(s).`);
  return items;
}

async function resolveIntakeImages(record) {
  const slotSubmissionId = getTrimmedString(record.fields['JotForm Submission ID']);
  if (!slotSubmissionId) {
    logProgress(`Record ${record.id} has no JotForm Submission ID; seeding intake images.`);
    return {
      source: 'seed',
      images: await archiveSeededStageImages(record, 'intake'),
    };
  }

  if (!getEnv('VITE_JOTFORM_API_KEY')) {
    throw new Error(`Record ${record.id} has a JotForm Submission ID but VITE_JOTFORM_API_KEY is missing.`);
  }

  const submissionItems = await getJotFormSubmissionItems(slotSubmissionId);
  const imageUrls = isOldFormatSubmissionId(slotSubmissionId)
    ? submissionItems.flatMap((item) => item.imageUrls)
    : (submissionItems.find((item) => item.submissionId === slotSubmissionId)?.imageUrls ?? []);

  if (imageUrls.length === 0) {
    throw new Error(`No JotForm intake images found for submission ${slotSubmissionId}.`);
  }

  logProgress(`Archiving ${imageUrls.length} JotForm intake image(s) for record ${record.id}.`, {
    recordId: record.id,
    submissionId: slotSubmissionId,
  });
  const archivedFiles = await archiveIntakeImagesForRecord(record.id, imageUrls);
  const existingMetadata = parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']);
  const nextMetadata = replaceIntakeImageMetadata(existingMetadata, archivedFiles);
  const intakeImages = nextMetadata.filter((entry) => entry.sourceStage === 'intake');

  return {
    source: 'jotform',
    images: intakeImages,
  };
}

function replaceStageMetadata(records, stage, nextStageRecords) {
  const preserved = records.filter((record) => record.sourceStage !== stage);
  return [
    ...preserved,
    ...nextStageRecords.map((record, index) => ({
      ...record,
      sourceStage: stage,
      sortOrder: index + 1,
    })),
  ].map((record, index) => ({
    ...record,
    sortOrder: index + 1,
  }));
}

function buildCurrentImages(stageImages) {
  return stageImages.map((image) => ({ url: image.url, filename: image.filename }));
}

async function loadWorkflowRecords() {
  return getConfiguredRecords('used-gear-workflow', {
    fields: [
      'Workflow Status',
      'Workflow Image Metadata JSON',
      'Images',
      'JotForm Submission ID',
      'SKU',
      'SKU Legacy Backup',
      'Make',
      'Model',
      'Item Title',
    ],
  });
}

function buildPlanSummary(records) {
  const byStatus = {};
  let jotFormCount = 0;
  let seededIntakeCount = 0;

  for (const record of records) {
    const workflowStatus = getTrimmedString(record.fields['Workflow Status']) || '(blank)';
    const stagePlan = getStagePlan(workflowStatus);
    const slotSubmissionId = getTrimmedString(record.fields['JotForm Submission ID']);
    if (slotSubmissionId) {
      jotFormCount += 1;
    } else {
      seededIntakeCount += 1;
    }

    byStatus[workflowStatus] ??= {
      count: 0,
      metadataStages: stagePlan.metadataStages,
      imageStage: stagePlan.imageStage,
    };
    byStatus[workflowStatus].count += 1;
  }

  return {
    totalRecords: records.length,
    jotFormIntakeRecords: jotFormCount,
    seededIntakeRecords: seededIntakeCount,
    byStatus,
  };
}

async function runPlan(records) {
  const summary = buildPlanSummary(records);
  const runDir = createRunDirectory('plan');
  writeJson(path.join(runDir, 'summary.json'), {
    createdAt: new Date().toISOString(),
    mode: 'plan',
    summary,
  });

  console.log(`Plan written to ${runDir}`);
  console.log(`Total workflow rows: ${summary.totalRecords}`);
  console.log(`JotForm intake rows: ${summary.jotFormIntakeRecords}`);
  console.log(`Seeded intake rows: ${summary.seededIntakeRecords}`);
  for (const [status, value] of Object.entries(summary.byStatus)) {
    console.log(`- ${status}: ${value.count} row(s) -> metadata [${value.metadataStages.join(', ')}]${value.imageStage ? `, Images=${value.imageStage}` : ''}`);
  }
}

async function runApply(records) {
  const runDir = createRunDirectory('apply');
  const results = [];

  logProgress(`Starting apply run for ${records.length} workflow row(s).`, { runDir });

  for (const [index, record] of records.entries()) {
    const workflowStatus = getTrimmedString(record.fields['Workflow Status']);
    const { metadataStages, imageStage } = getStagePlan(workflowStatus);
    const itemTitle = getTrimmedString(record.fields['Item Title']) || getTrimmedString(record.fields.SKU) || record.id;

    logProgress(`Processing row ${index + 1}/${records.length}: ${itemTitle}`, {
      recordId: record.id,
      workflowStatus,
      metadataStages,
      imageStage,
    });

    try {
      const intakeResult = await resolveIntakeImages(record);
      logProgress(`Resolved intake images for record ${record.id}.`, {
        intakeSource: intakeResult.source,
        intakeCount: intakeResult.images.length,
      });
      let nextMetadata = replaceStageMetadata(parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']), 'intake', intakeResult.images);

      let testingImages = [];
      let photoImages = [];

      if (metadataStages.includes('testing')) {
        logProgress(`Seeding testing originals + processed images for record ${record.id}.`);
        testingImages = await archiveSeededStageImages(record, 'testing');
        nextMetadata = replaceStageMetadata(nextMetadata, 'testing', testingImages);
      } else {
        nextMetadata = replaceStageMetadata(nextMetadata, 'testing', []);
      }

      if (metadataStages.includes('photos')) {
        logProgress(`Seeding photography originals + processed images for record ${record.id}.`);
        photoImages = await archiveSeededStageImages(record, 'photos');
        nextMetadata = replaceStageMetadata(nextMetadata, 'photos', photoImages);
      } else {
        nextMetadata = replaceStageMetadata(nextMetadata, 'photos', []);
      }

      const currentStageImages = imageStage === 'photos'
        ? photoImages
        : imageStage === 'testing'
          ? testingImages
          : [];

      const updated = await updateConfiguredRecord(
        'used-gear-workflow',
        record.id,
        {
          Images: buildCurrentImages(currentStageImages),
          'Workflow Image Metadata JSON': serializeWorkflowImageMetadata(nextMetadata),
        },
        { typecast: true },
      );

      results.push({
        recordId: record.id,
        workflowStatus,
        intakeSource: intakeResult.source,
        metadataStages,
        imageStage,
        intakeCount: intakeResult.images.length,
        testingCount: testingImages.length,
        photoCount: photoImages.length,
        updatedRecordId: updated.id,
      });

      logProgress(`Updated record ${record.id}.`, {
        intakeSource: intakeResult.source,
        intakeCount: intakeResult.images.length,
        testingCount: testingImages.length,
        photoCount: photoImages.length,
        imageStage,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        recordId: record.id,
        workflowStatus,
        error: errorMessage,
      });
      logProgress(`Failed record ${record.id}.`, {
        workflowStatus,
        error: errorMessage,
      });
    }
  }

  const summary = {
    createdAt: new Date().toISOString(),
    mode: 'apply',
    totalRecords: records.length,
    updatedCount: results.filter((result) => !result.error).length,
    failedCount: results.filter((result) => Boolean(result.error)).length,
    results,
  };

  writeJson(path.join(runDir, 'summary.json'), summary);
  logProgress(`Apply run complete.`, {
    updatedCount: summary.updatedCount,
    failedCount: summary.failedCount,
    runDir,
  });
  console.log(`Updated ${summary.updatedCount} workflow row(s); ${summary.failedCount} failed.`);
  console.log(`Artifacts saved in ${runDir}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args._[0] || 'plan';
  if (mode !== 'plan' && mode !== 'apply') {
    throw new Error('Usage: node scripts/backfill-all-workflow-drive-images.mjs [plan|apply] [--confirm TOKEN]');
  }

  if (mode === 'apply' && (args.confirm || '') !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }

  setProviderEnv();
  const records = await loadWorkflowRecords();

  if (mode === 'plan') {
    await runPlan(records);
    return;
  }

  await runApply(records);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});