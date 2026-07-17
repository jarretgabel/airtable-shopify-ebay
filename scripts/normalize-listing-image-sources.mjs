#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const APPLY_CONFIRM_TOKEN = 'NORMALIZE_LISTING_IMAGE_SOURCES';

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseJsonValue(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeIdentityToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, '');
}

function resolveEnv() {
  const apiKey = process.env.VITE_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
  const baseId = process.env.VITE_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME || process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME || 'tbl0K0nFQL64jQMx8';

  if (!apiKey) throw new Error('Missing VITE_AIRTABLE_API_KEY or AIRTABLE_API_KEY');
  if (!baseId) throw new Error('Missing VITE_AIRTABLE_BASE_ID or AIRTABLE_BASE_ID');
  if (!tableId) throw new Error('Missing combined listings table id');

  return { apiKey, baseId, tableId };
}

async function airtableFetchRecord({ apiKey, baseId, tableId, recordId }) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

async function airtablePatchRecord({ apiKey, baseId, tableId, recordId, fields }) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new Error(`Update failed (${response.status}): ${await response.text()}`);
  }

  return response.json();
}

function summarize(recordId, images, metadata) {
  const metadataByStage = metadata.reduce((acc, entry) => {
    const stage = String(entry.sourceStage || 'unknown');
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  const processedMetadata = metadata.filter((entry) => /(^|[-_])processed/.test(String(entry.filename || '').toLowerCase()));
  const imageNameSet = new Set(images.map((entry) => normalizeIdentityToken(entry.filename || entry.url || entry.id || '')));
  const processedPhotoDuplicates = processedMetadata.filter((entry) => {
    if (String(entry.sourceStage || '') !== 'photos') return false;
    const key = normalizeIdentityToken(entry.filename || entry.url || entry.attachmentId || '');
    return key && imageNameSet.has(key);
  });

  return {
    recordId,
    imagesCount: images.length,
    metadataCount: metadata.length,
    metadataByStage,
    processedMetadataCount: processedMetadata.length,
    duplicateProcessedPhotosVsImagesCount: processedPhotoDuplicates.length,
    duplicateProcessedPhotosVsImages: processedPhotoDuplicates.map((entry) => ({
      attachmentId: entry.attachmentId,
      filename: entry.filename,
      sourceStage: entry.sourceStage,
      includedInListing: entry.includedInListing,
      url: entry.url,
    })),
  };
}

function normalizeForPreferImages(images, metadata) {
  const imageNameSet = new Set(images.map((entry) => normalizeIdentityToken(entry.filename || entry.url || entry.id || '')));

  const normalizedMetadata = metadata.filter((entry) => {
    const stage = String(entry.sourceStage || '');
    if (stage !== 'photos') return true;

    const filename = String(entry.filename || '');
    const isProcessed = /(^|[-_])processed/.test(filename.toLowerCase());
    if (!isProcessed) return true;

    const key = normalizeIdentityToken(filename || entry.url || entry.attachmentId || '');
    return !key || !imageNameSet.has(key);
  });

  return {
    workflowImageMetadataJson: JSON.stringify(normalizedMetadata),
  };
}

function printUsage() {
  console.log('Usage: node scripts/normalize-listing-image-sources.mjs --record <recordId> [--strategy prefer-images] [--apply --confirm NORMALIZE_LISTING_IMAGE_SOURCES]');
  console.log('');
  console.log('Strategies:');
  console.log('  prefer-images  Keep Images field as canonical photo source and remove duplicate processed photos from Workflow Image Metadata JSON.');
  console.log('');
  console.log('Defaults: dry-run only (no Airtable writes).');
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    return;
  }

  const recordId = readArg('--record');
  const strategy = readArg('--strategy', 'prefer-images');
  const apply = hasFlag('--apply');
  const confirm = readArg('--confirm');

  if (!recordId) {
    printUsage();
    throw new Error('Missing required --record argument');
  }

  if (strategy !== 'prefer-images') {
    throw new Error(`Unsupported strategy: ${strategy}`);
  }

  if (apply && confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Missing confirm token. Re-run with --confirm ${APPLY_CONFIRM_TOKEN}`);
  }

  const env = resolveEnv();
  const record = await airtableFetchRecord({
    ...env,
    recordId,
  });

  const fields = record.fields || {};
  const images = parseJsonValue(fields.Images) || [];
  const metadata = parseJsonValue(fields['Workflow Image Metadata JSON']) || [];

  const beforeSummary = summarize(recordId, images, metadata);
  const normalized = normalizeForPreferImages(images, metadata);
  const afterMetadata = parseJsonValue(normalized.workflowImageMetadataJson) || [];
  const afterSummary = summarize(recordId, images, afterMetadata);

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    strategy,
    before: beforeSummary,
    after: afterSummary,
  }, null, 2));

  if (!apply) return;

  await airtablePatchRecord({
    ...env,
    recordId,
    fields: {
      'Workflow Image Metadata JSON': normalized.workflowImageMetadataJson,
    },
  });

  console.log('Applied metadata normalization successfully.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
