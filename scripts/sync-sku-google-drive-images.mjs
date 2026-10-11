import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const APPLY_CONFIRM_TOKEN = 'SYNC_SKU_GOOGLE_DRIVE_PROCESSED_IMAGES';
const RUNS_DIR = path.join(process.cwd(), 'tmp', 'sku-google-drive-image-sync');
const AIRTABLE_PAGE_SIZE = 100;
const DRIVE_PAGE_SIZE = 1000;
const LISTING_STATUSES = [
  'Awaiting Pre-Listing Review',
  'Approved for Publish',
  'Listed, Shopify',
  'Listed, eBay',
  'Stale Listing, Shopify',
  'Stale Listing, eBay',
];
const DRIVE_HOSTS = new Set([
  'drive.google.com',
  'drive.usercontent.google.com',
  'googleusercontent.com',
]);
const GOOGLE_DRIVE_IMAGE_URL = (fileId) => (
  `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
);

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[name] = true;
      continue;
    }
    args[name] = next;
    index += 1;
  }
  return args;
}

function requireEnv(names, label) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${label} (${names.join(' or ')}).`);
}

async function fetchWithRetry(url, options) {
  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw new Error(`Network request failed after ${maxAttempts} attempts: ${String(url)}`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** (attempt - 1))));
    }
  }
  throw new Error(`Network request failed after ${maxAttempts} attempts: ${String(url)}`);
}

function resolveEnv() {
  return {
    airtableApiKey: requireEnv(['VITE_AIRTABLE_API_KEY', 'AIRTABLE_API_KEY'], 'Airtable API key'),
    airtableBaseId: requireEnv(['VITE_AIRTABLE_BASE_ID', 'AIRTABLE_BASE_ID'], 'Airtable base ID'),
    airtableTableId: requireEnv(
      ['VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME', 'AIRTABLE_COMBINED_LISTINGS_TABLE_NAME'],
      'combined listings table ID',
    ),
    driveClientId: requireEnv(['VITE_GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_ID'], 'Google Drive client ID'),
    driveClientSecret: requireEnv(['VITE_GOOGLE_DRIVE_CLIENT_SECRET', 'GOOGLE_DRIVE_CLIENT_SECRET'], 'Google Drive client secret'),
    driveRefreshToken: requireEnv(['VITE_GOOGLE_DRIVE_REFRESH_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN'], 'Google Drive refresh token'),
  };
}

function parseMetadata(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('Workflow Image Metadata JSON is not valid JSON.');
  }
}

function asText(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text.trim();
  return '';
}

function isDriveUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:'
      && (DRIVE_HOSTS.has(hostname) || hostname.endsWith('.googleusercontent.com'));
  } catch {
    return false;
  }
}

function getDriveFileId(value) {
  if (typeof value !== 'string') return '';
  try {
    const parsed = new URL(value);
    const queryId = parsed.searchParams.get('id')?.trim();
    if (queryId) return queryId;
    return parsed.pathname.match(/\/d\/([^/]+)/)?.[1] ?? '';
  } catch {
    return '';
  }
}

function isOriginal(filename) {
  return /(^|[-_.\s])original([-_.\s]|$)/i.test(filename);
}

function isSeedImage(filename, sku) {
  const escapedSku = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^(intake|testing|photos)--${escapedSku}-.+-(intake|testing|photos)-\\d+-(original--original|processed)\\.jpe?g$`,
    'i',
  ).test(filename);
}

function hasProcessedMarker(filename) {
  return /(^|[-_])processed(?=\.[^.]+$|$)/i.test(filename);
}

function isCameraGeneratedImage(filename) {
  return /^(?:\d{1,3}[-_ ])?(?:IMG|DSCF?|DSCN|DSC|PXL|CAM|PHOTO)[-_ ]?\d/i.test(filename);
}

function checkImageFilename(filename) {
  const reasons = [];
  const lower = filename.toLowerCase();
  const words = lower.replace(/\.jpe?g$/, '').split('-');

  if (!/^[a-z0-9]+(?:-[a-z0-9]+){3,9}\.jpg$/.test(filename)) {
    reasons.push('Use lowercase ASCII kebab-case with 4–10 words and a .jpg extension.');
  }
  if (/(^|-)processed\.jpg$/i.test(filename) || /(^|-)original\.jpg$/i.test(filename)) {
    reasons.push('Do not add processed/original or version suffixes to the listing filename.');
  }
  if (/(^|-)img[-_]?\d|(^|-)dscf?\d|(^|-)dscn?\d/i.test(filename)) {
    reasons.push('Replace camera-generated filenames with the product naming pattern.');
  }
  if (/-\d+\.jpg$/i.test(filename)) {
    reasons.push('Remove trailing sequence/random numbers; retain numbers only when they are part of the model name.');
  }
  if (/(^|-)resolution(av|-audio-video|-av)?(-|\.jpg$)/i.test(filename)) {
    reasons.push('Do not include the company name in the image filename.');
  }
  if (words.some((word) => word.length === 0)) {
    reasons.push('Remove duplicate or trailing hyphens.');
  }

  return { valid: reasons.length === 0, reasons };
}

function buildImageAlt(filename, recordFields) {
  const title = asText(recordFields['Item Title'])
    || [asText(recordFields.Make), asText(recordFields.Model)].filter(Boolean).join(' ')
    || asText(recordFields.SKU);
  const detail = filename.replace(/\.jpe?g$/i, '').replace(/-/g, ' ');
  return `${title} ${detail}`.trim();
}

function createRunDirectory() {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const runDir = path.join(RUNS_DIR, `audit-${stamp}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

async function readAirtablePage(env, offset) {
  const tableUrl = `https://api.airtable.com/v0/${encodeURIComponent(env.airtableBaseId)}/${encodeURIComponent(env.airtableTableId)}`;
  const params = new URLSearchParams({
    pageSize: String(AIRTABLE_PAGE_SIZE),
    filterByFormula: `OR(${LISTING_STATUSES.map((status) => `{Workflow Status}='${status}'`).join(',')})`,
  });
  for (const field of ['SKU', 'Workflow Status', 'Workflow Image Metadata JSON', 'Images', 'Item Title', 'Make', 'Model']) {
    params.append('fields[]', field);
  }
  if (offset) params.set('offset', offset);

  const response = await fetchWithRetry(`${tableUrl}?${params}`, {
    headers: { Authorization: `Bearer ${env.airtableApiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Airtable list failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function getListingRecords(env) {
  const records = [];
  let offset;
  do {
    const page = await readAirtablePage(env, offset);
    records.push(...(Array.isArray(page.records) ? page.records : []));
    offset = page.offset;
  } while (offset);

  return records.sort((left, right) => (
    Date.parse(right.createdTime ?? '') - Date.parse(left.createdTime ?? '')
  ));
}

async function getDriveToken(env) {
  const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.driveClientId,
      client_secret: env.driveClientSecret,
      refresh_token: env.driveRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(`Google Drive token request failed (${response.status}): ${await response.text()}`);
  }
  const body = await response.json();
  if (!body.access_token) throw new Error('Google Drive token response did not include an access token.');
  return body.access_token;
}

async function listDriveFiles(token, query) {
  const files = [];
  const params = new URLSearchParams({
    q: query,
    fields: 'nextPageToken,files(id,name,mimeType,parents,webViewLink,md5Checksum,size)',
    pageSize: String(DRIVE_PAGE_SIZE),
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    corpora: 'allDrives',
  });
  let pageToken;
  do {
    if (pageToken) params.set('pageToken', pageToken);
    const response = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Google Drive list failed (${response.status}): ${await response.text()}`);
    }
    const body = await response.json();
    files.push(...(Array.isArray(body.files) ? body.files : []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

async function findSkuFolders(token, sku) {
  const escapedSku = sku.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return listDriveFiles(
    token,
    `name = '${escapedSku}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
}

async function listFolderImages(token, folderId) {
  const escapedFolderId = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const files = await listDriveFiles(
    token,
    `'${escapedFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
  );
  return files.filter((file) => file.id && file.name && file.mimeType?.startsWith('image/'));
}

async function verifyPublicImage(fileId) {
  const url = GOOGLE_DRIVE_IMAGE_URL(fileId);
  const response = await fetchWithRetry(url, { method: 'HEAD', redirect: 'follow' });
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  return {
    url,
    accessible: response.ok && contentType.startsWith('image/'),
    status: response.status,
    contentType,
  };
}

function getExistingPhotoIds(metadata) {
  return new Set(metadata
    .filter((item) => item?.sourceStage === 'photos'
      && item.includedInListing !== false
      && isDriveUrl(item.url)
      && !isOriginal(asText(item.filename)))
    .map((item) => asText(item.attachmentId) || getDriveFileId(item.url))
    .filter(Boolean));
}

function getExistingDriveFileIds(metadata) {
  return new Set(metadata
    .filter((item) => isDriveUrl(item?.url))
    .map((item) => asText(item.attachmentId) || getDriveFileId(item.url))
    .filter(Boolean));
}

function getSeededPhotoEntries(metadata, sku) {
  return metadata.filter((item) => item?.sourceStage === 'photos'
    && isSeedImage(asText(item.filename), sku));
}

function parseSkipSkus(value) {
  return new Set(String(value ?? '')
    .split(',')
    .map((sku) => sku.trim())
    .filter(Boolean));
}

async function auditRecord(record, driveToken, skipSkus, approvedFileIds, { compareAll = false } = {}) {
  const fields = record.fields ?? {};
  const sku = asText(fields.SKU);
  const workflowStatus = asText(fields['Workflow Status']);
  const metadata = parseMetadata(fields['Workflow Image Metadata JSON']);
  const existingPhotoIds = getExistingPhotoIds(metadata);
  const existingListingImageIds = new Set(metadata
    .filter((item) => ['testing', 'photos'].includes(item?.sourceStage)
      && item.includedInListing !== false
      && isDriveUrl(item.url)
      && !isOriginal(asText(item.filename)))
    .map((item) => asText(item.attachmentId) || getDriveFileId(item.url))
    .filter(Boolean));
  const existingDriveFileIds = getExistingDriveFileIds(metadata);
  const seededPhotos = getSeededPhotoEntries(metadata, sku);
  const legacyAttachments = Array.isArray(fields.Images) ? fields.Images.length : 0;
  const base = {
    recordId: record.id,
    createdTime: record.createdTime ?? '',
    sku,
    itemTitle: asText(fields['Item Title']),
    workflowStatus,
    existingDrivePhotoCount: existingPhotoIds.size,
    seededPhotoMetadataCount: seededPhotos.length,
    legacyAttachmentCount: legacyAttachments,
  };

  if (skipSkus.has(sku)) {
    return { ...base, status: 'user-skipped', reason: 'Explicitly skipped by --skip-skus.' };
  }

  if (!compareAll && approvedFileIds.size === 0 && existingPhotoIds.size > 0 && seededPhotos.length === 0) {
    return {
      ...base,
      status: 'already-present',
      reason: 'Included photos-stage Google Drive image URLs already exist; no change planned.',
    };
  }

  if (!sku) {
    return { ...base, status: 'needs-review', reason: 'Record has no SKU to match against Drive folders.' };
  }

  const folders = await findSkuFolders(driveToken, sku);
  if (folders.length === 0) {
    return { ...base, status: 'no-sku-folder', reason: 'No exact SKU-named Google Drive folder was found.', folders: [] };
  }

  const folderResults = [];
  for (const folder of folders) {
    const images = await listFolderImages(driveToken, folder.id);
    const imageResults = [];
    for (const image of images) {
      const naming = checkImageFilename(image.name);
      imageResults.push({
        id: image.id,
        filename: image.name,
        mimeType: image.mimeType,
        md5Checksum: image.md5Checksum ?? '',
        size: image.size ?? '',
        processedMarker: hasProcessedMarker(image.name) && !isOriginal(image.name),
        originalMarker: isOriginal(image.name),
        cameraGenerated: isCameraGeneratedImage(image.name),
        seedImage: isSeedImage(image.name, sku),
        namingConventionValid: naming.valid,
        namingIssues: naming.reasons,
        alreadyInMetadata: existingDriveFileIds.has(image.id),
        alreadyInPhotosMetadata: existingPhotoIds.has(image.id),
        alreadyInListingMetadata: existingListingImageIds.has(image.id),
      });
    }
    const brandModelPrefixes = new Set(imageResults
      .filter((image) => image.namingConventionValid)
      .map((image) => image.filename.replace(/\.jpg$/i, '').split('-').slice(0, 2).join('-')));
    if (brandModelPrefixes.size > 1) {
      for (const image of imageResults) {
        if (!image.namingConventionValid) continue;
        image.namingConventionValid = false;
        image.namingIssues.push('Keep the same brand-model prefix across images in this folder.');
      }
    }
    folderResults.push({
      folderId: folder.id,
      parentIds: Array.isArray(folder.parents) ? folder.parents : [],
      images: imageResults,
    });
  }

  const uniqueProcessed = folderResults.flatMap((folder) => folder.images
    .filter((image) => image.processedMarker)
    .map((image) => ({ ...image, folderId: folder.folderId })));
  const selectedFolderIds = new Set(uniqueProcessed.map((image) => image.folderId));
  const alreadyInPhotos = uniqueProcessed.filter((image) => image.alreadyInPhotosMetadata);
  const missingProcessed = uniqueProcessed.filter((image) => !image.alreadyInMetadata);
  const missingCanonicalNames = folderResults.flatMap((folder) => folder.images
    .filter((image) => !image.alreadyInMetadata && !image.originalMarker && image.namingConventionValid)
    .map((image) => ({ ...image, folderId: folder.folderId })));
  const approvedCandidates = missingCanonicalNames.filter((image) => approvedFileIds.has(image.id));

  if (compareAll) {
    const contentGroups = new Map();
    for (const folder of folderResults) {
      for (const image of folder.images) {
        const key = image.md5Checksum ? `md5:${image.md5Checksum}` : `file:${image.id}`;
        const group = contentGroups.get(key) ?? {
          md5Checksum: image.md5Checksum,
          files: [],
          fileIds: new Set(),
          listingLinked: false,
          processedMarker: false,
          originalMarker: true,
          namingConventionValid: false,
        };
        group.files.push({ ...image, folderId: folder.folderId });
        group.fileIds.add(image.id);
        group.listingLinked ||= image.alreadyInListingMetadata;
        group.processedMarker ||= image.processedMarker;
        group.originalMarker &&= image.originalMarker;
        group.cameraGenerated ||= image.cameraGenerated;
        group.seedImage ||= image.seedImage;
        group.namingConventionValid ||= image.namingConventionValid;
        contentGroups.set(key, group);
      }
    }

    const groups = [...contentGroups.values()];
    const unlinkedProcessedGroups = groups.filter((group) => (
      group.processedMarker && !group.listingLinked
    ));
    const unlinkedListingStyleGroups = groups.filter((group) => (
      !group.listingLinked && !group.originalMarker && group.namingConventionValid
    ));
    const unlinkedOtherNonOriginalGroups = groups.filter((group) => (
      !group.listingLinked
      && !group.processedMarker
      && !group.originalMarker
      && !group.cameraGenerated
      && !group.seedImage
      && !group.namingConventionValid
    ));
    const unlinkedCameraGeneratedGroups = groups.filter((group) => (
      !group.listingLinked && group.cameraGenerated
    ));
    const unlinkedSeedImageGroups = groups.filter((group) => (
      !group.listingLinked && group.seedImage
    ));
    const unlinkedOriginalGroups = groups.filter((group) => (
      !group.listingLinked && group.originalMarker
    ));
    const status = unlinkedProcessedGroups.length > 0
      ? 'confirmed-processed-gap'
      : unlinkedListingStyleGroups.length > 0
        ? 'needs-visual-review'
        : unlinkedOtherNonOriginalGroups.length > 0
          ? 'needs-classification'
          : 'all-folder-images-accounted';

    return {
      ...base,
      status,
      reason: 'Compared file IDs and duplicate-file content hashes in every exact-SKU folder against included testing/photos-stage metadata.',
      existingDriveFileCount: existingDriveFileIds.size,
      folderCount: folderResults.length,
      folderImageFileCount: folderResults.reduce((count, folder) => count + folder.images.length, 0),
      distinctFolderImageCount: groups.length,
      listingLinkedFolderImageCount: groups.filter((group) => group.listingLinked).length,
      unlinkedProcessedImageCount: unlinkedProcessedGroups.length,
      unlinkedListingStyleImageCount: unlinkedListingStyleGroups.length,
      unlinkedCameraGeneratedImageCount: unlinkedCameraGeneratedGroups.length,
      unlinkedSeedImageCount: unlinkedSeedImageGroups.length,
      unlinkedOtherNonOriginalImageCount: unlinkedOtherNonOriginalGroups.length,
      unlinkedOriginalImageCount: unlinkedOriginalGroups.length,
      folders: folderResults,
      contentGroups: groups.map((group) => ({
        md5Checksum: group.md5Checksum,
        fileIds: [...group.fileIds],
        filenames: [...new Set(group.files.map((file) => file.filename))],
        folderIds: [...new Set(group.files.map((file) => file.folderId))],
        listingLinked: group.listingLinked,
        processedMarker: group.processedMarker,
        originalMarker: group.originalMarker,
        cameraGenerated: group.cameraGenerated,
        seedImage: group.seedImage,
        namingConventionValid: group.namingConventionValid,
      })),
      addImages: [],
    };
  }

  let status = 'needs-manual-review';
  let reason = 'SKU folder images lack an explicit processed marker; inspect/confirm processed exports before linking.';
  let addImages = [];

  if (approvedCandidates.length > 0) {
    const approvedFolderIds = new Set(approvedCandidates.map((image) => image.folderId));
    if (approvedFolderIds.size > 1) {
      status = 'duplicate-sku-folders';
      reason = 'Manually approved processed candidates are in multiple exact-SKU folders; select the authoritative folder.';
    } else {
      const verified = [];
      for (const image of approvedCandidates) {
        const publicCheck = await verifyPublicImage(image.id);
        verified.push({ ...image, ...publicCheck });
      }
      if (verified.every((image) => image.accessible)) {
        status = 'ready-to-add';
        reason = 'Manually confirmed processed watermark; unique SKU folder, public image URL, and filename convention verified.';
        addImages = verified.map((image, index) => ({
          attachmentId: image.id,
          url: image.url,
          filename: image.filename,
          alt: buildImageAlt(image.filename, fields),
          sortOrder: index + 1,
          sourceStage: 'photos',
          includedInListing: true,
        }));
      } else {
        status = 'drive-access-check-failed';
        reason = 'One or more approved Drive images are not publicly readable as image content.';
      }
    }
  } else if (approvedFileIds.size > 0) {
    reason = 'Explicit-approval audit only plans selected file IDs; all other candidates remain unchanged.';
  } else if (seededPhotos.length > 0) {
    reason = 'Existing photos metadata matches the workflow seed-image naming pattern; replace only after identifying real processed SKU-folder photos.';
  } else if (missingProcessed.length > 0 && selectedFolderIds.size > 1) {
    status = 'duplicate-sku-folders';
    reason = 'Processed-marked candidates occur in multiple exact-SKU folders; select the authoritative folder before linking.';
  } else if (missingProcessed.length > 0) {
    const invalidNames = missingProcessed.filter((image) => !image.namingConventionValid);
    if (invalidNames.length > 0) {
      status = 'needs-filename-cleanup';
      reason = 'Processed-marked files do not follow the listing-image naming convention.';
    } else {
      const verified = [];
      for (const image of missingProcessed) {
        const publicCheck = await verifyPublicImage(image.id);
        verified.push({ ...image, ...publicCheck });
      }
      if (verified.every((image) => image.accessible)) {
        status = 'ready-to-add';
        reason = 'Unique SKU folder contains public, processed-marked JPGs that follow the filename convention.';
        addImages = verified.map((image, index) => ({
          attachmentId: image.id,
          url: image.url,
          filename: image.filename,
          alt: buildImageAlt(image.filename, fields),
          sortOrder: index + 1,
          sourceStage: 'photos',
          includedInListing: true,
        }));
      } else {
        status = 'drive-access-check-failed';
        reason = 'One or more processed Drive images are not publicly readable as image content.';
      }
    }
  } else if (missingCanonicalNames.length > 0) {
    const candidateFolderIds = new Set(missingCanonicalNames.map((image) => image.folderId));
    if (candidateFolderIds.size > 1) {
      status = 'duplicate-sku-folders';
      reason = 'Listing-style candidates occur in multiple exact-SKU folders; identify the authoritative folder and confirm processing before linking.';
    } else {
      status = 'needs-manual-review';
      reason = 'Unlinked files have listing-style names but no explicit processed marker; verify the processed watermark before linking.';
    }
  } else if (folderResults.every((folder) => folder.images.length > 0)
    && folderResults.every((folder) => folder.images.every((image) => image.alreadyInMetadata))) {
    status = 'already-in-metadata';
    reason = 'All files in the matching SKU folder already have Drive-backed workflow metadata; no duplicate URLs will be added.';
  } else if (alreadyInPhotos.length > 0 && seededPhotos.length === 0) {
    status = 'already-present';
    reason = 'All processed-marked SKU-folder images already exist in photos metadata.';
  }

  if (skipSkus.has(sku)) {
    status = 'user-skipped';
    reason = 'Explicitly skipped by --skip-skus.';
    addImages = [];
  }

  return {
    ...base,
    status,
    reason,
    existingNonPhotosDriveCount: metadata.filter((item) => (
      item?.sourceStage !== 'photos' && isDriveUrl(item?.url)
    )).length,
    folders: folderResults,
    reviewCandidates: missingCanonicalNames.map((image) => ({
      fileId: image.id,
      filename: image.filename,
      folderId: image.folderId,
    })),
    addImages,
    removeSeededPhotoMetadata: addImages.length > 0 && seededPhotos.length > 0,
    expectedMetadataJson: addImages.length > 0
      ? (typeof fields['Workflow Image Metadata JSON'] === 'string'
          ? fields['Workflow Image Metadata JSON']
          : JSON.stringify(metadata))
      : undefined,
  };
}

function toCsvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(records) {
  const headers = [
    'createdTime',
    'recordId',
    'sku',
    'workflowStatus',
    'status',
    'reason',
    'existingDrivePhotoCount',
    'seededPhotoMetadataCount',
    'seededPhotoMetadataToRemove',
    'legacyAttachmentCount',
    'folders',
    'files',
  ];
  const rows = records.map((record) => [
    record.createdTime,
    record.recordId,
    record.sku,
    record.workflowStatus,
    record.status,
    record.reason,
    record.existingDrivePhotoCount,
    record.seededPhotoMetadataCount,
    record.removeSeededPhotoMetadata ? record.seededPhotoMetadataCount : 0,
    record.legacyAttachmentCount,
    (record.folders ?? []).map((folder) => folder.folderId).join('; '),
    (record.folders ?? []).flatMap((folder) => folder.images.map((image) => (
      `folder=${folder.folderId};file=${image.id};name=${image.filename};url=${GOOGLE_DRIVE_IMAGE_URL(image.id)};processedMarker=${image.processedMarker};alreadyInMetadata=${image.alreadyInMetadata};namingValid=${image.namingConventionValid}${image.namingIssues.length ? `;namingIssues=${image.namingIssues.join('|')}` : ''}`
    ))).join('; '),
  ]);
  return `${[headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n')}\n`;
}

function toCoverageCsv(records) {
  const headers = [
    'createdTime',
    'recordId',
    'sku',
    'workflowStatus',
    'coverageStatus',
    'folderCount',
    'folderImageFileCount',
    'distinctFolderImageCount',
    'listingLinkedFolderImageCount',
    'unlinkedProcessedImageCount',
    'unlinkedListingStyleImageCount',
    'unlinkedCameraGeneratedImageCount',
    'unlinkedSeedImageCount',
    'unlinkedOtherNonOriginalImageCount',
    'unlinkedOriginalImageCount',
    'folderId',
    'fileId',
    'filename',
    'mimeType',
    'size',
    'md5Checksum',
    'processedMarker',
    'originalMarker',
    'cameraGenerated',
    'seedImage',
    'namingConventionValid',
    'includedListingImageMetadataMatch',
    'duplicateContentFileIds',
    'duplicateContentAccounted',
    'url',
  ];
  const rows = [];
  for (const record of records) {
    const groupByFileId = new Map();
    for (const group of record.contentGroups ?? []) {
      for (const fileId of group.fileIds) groupByFileId.set(fileId, group);
    }
    const files = (record.folders ?? []).flatMap((folder) => folder.images.map((image) => ({
      folderId: folder.folderId,
      image,
      group: groupByFileId.get(image.id),
    })));
    const base = [
      record.createdTime,
      record.recordId,
      record.sku,
      record.workflowStatus,
      record.status,
      record.folderCount,
      record.folderImageFileCount,
      record.distinctFolderImageCount,
      record.listingLinkedFolderImageCount,
      record.unlinkedProcessedImageCount,
      record.unlinkedListingStyleImageCount,
      record.unlinkedCameraGeneratedImageCount,
      record.unlinkedSeedImageCount,
      record.unlinkedOtherNonOriginalImageCount,
      record.unlinkedOriginalImageCount,
    ];
    if (files.length === 0) {
      rows.push([...base, ...Array(15).fill('')]);
      continue;
    }
    for (const { folderId, image, group } of files) {
      rows.push([
        ...base,
        folderId,
        image.id,
        image.filename,
        image.mimeType,
        image.size,
        image.md5Checksum,
        image.processedMarker,
        image.originalMarker,
        image.cameraGenerated,
        image.seedImage,
        image.namingConventionValid,
        image.alreadyInListingMetadata,
        (group?.fileIds ?? []).join('; '),
        group?.listingLinked ?? false,
        GOOGLE_DRIVE_IMAGE_URL(image.id),
      ]);
    }
  }
  return `${[headers, ...rows].map((row) => row.map(toCsvCell).join(',')).join('\n')}\n`;
}

function summarize(records) {
  const counts = {};
  for (const record of records) counts[record.status] = (counts[record.status] ?? 0) + 1;
  return {
    totalRecords: records.length,
    statusCounts: counts,
    plannedImageAdds: records.reduce((count, record) => count + (record.addImages?.length ?? 0), 0),
    recordsWithSeededMetadataRemoval: records.filter((record) => record.removeSeededPhotoMetadata).length,
    seededPhotoMetadataRemovals: records.reduce((count, record) => (
      count + (record.removeSeededPhotoMetadata ? record.seededPhotoMetadataCount : 0)
    ), 0),
    recordsWithLegacyAttachments: records.filter((record) => record.legacyAttachmentCount > 0).length,
    legacyAttachmentCount: records.reduce((count, record) => count + record.legacyAttachmentCount, 0),
    recordsWithSeededPhotoMetadata: records.filter((record) => record.seededPhotoMetadataCount > 0).length,
    unlinkedReviewCandidates: records.reduce((count, record) => count + (record.reviewCandidates?.length ?? 0), 0),
  };
}

function summarizeCoverage(records) {
  const count = (field) => records.reduce((total, record) => total + (record[field] ?? 0), 0);
  const statusCounts = {};
  for (const record of records) statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
  return {
    totalRecords: records.length,
    statusCounts,
    recordsWithSkuFolders: records.filter((record) => (record.folderCount ?? 0) > 0).length,
    matchingSkuFolders: count('folderCount'),
    folderImageFiles: count('folderImageFileCount'),
    distinctFolderImageContents: count('distinctFolderImageCount'),
    listingLinkedFolderImageContents: count('listingLinkedFolderImageCount'),
    unlinkedProcessedImageContents: count('unlinkedProcessedImageCount'),
    unlinkedListingStyleImageContents: count('unlinkedListingStyleImageCount'),
    unlinkedCameraGeneratedImageContents: count('unlinkedCameraGeneratedImageCount'),
    unlinkedSeedImageContents: count('unlinkedSeedImageCount'),
    unlinkedOtherNonOriginalImageContents: count('unlinkedOtherNonOriginalImageCount'),
    unlinkedOriginalImageContents: count('unlinkedOriginalImageCount'),
    recordsWithUnlinkedProcessedImages: records.filter((record) => (record.unlinkedProcessedImageCount ?? 0) > 0).length,
    recordsWithListingStyleImagesToReview: records.filter((record) => (record.unlinkedListingStyleImageCount ?? 0) > 0).length,
    recordsWithOtherImagesToClassify: records.filter((record) => (record.unlinkedOtherNonOriginalImageCount ?? 0) > 0).length,
  };
}

async function runAudit(env, args) {
  const skipSkus = parseSkipSkus(args['skip-skus']);
  const onlySkus = parseSkipSkus(args['only-skus']);
  const approvedFileIds = parseSkipSkus(args['approve-processed-file-ids']);
  const driveToken = await getDriveToken(env);
  const allRecords = await getListingRecords(env);
  const records = onlySkus.size > 0
    ? allRecords.filter((record) => onlySkus.has(asText(record.fields?.SKU)))
    : allRecords;
  const missingSkus = [...onlySkus].filter((sku) => !records.some((record) => asText(record.fields?.SKU) === sku));
  if (missingSkus.length > 0) {
    throw new Error(`Requested SKUs were not found in the Listings-page scope: ${missingSkus.join(', ')}`);
  }
  const results = [];
  for (const [index, record] of records.entries()) {
    const result = await auditRecord(record, driveToken, skipSkus, approvedFileIds);
    results.push(result);
    console.log(`[${index + 1}/${records.length}] SKU ${result.sku || '(missing)'}: ${result.status}`);
  }

  const reviewedCandidates = new Set(results.flatMap((record) => (
    (record.reviewCandidates ?? []).map((candidate) => candidate.fileId)
  )));
  const unknownApprovals = [...approvedFileIds].filter((fileId) => !reviewedCandidates.has(fileId));
  if (unknownApprovals.length > 0) {
    throw new Error(`Approved file IDs were not unlinked, naming-valid SKU-folder candidates: ${unknownApprovals.join(', ')}`);
  }

  const summary = summarize(results);
  const runDir = createRunDirectory();
  const planPath = path.join(runDir, 'plan.json');
  const reportPath = path.join(runDir, 'audit.csv');
  fs.writeFileSync(planPath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    source: 'approval-combined',
    subset: 'listings-page',
    skippedSkus: [...skipSkus],
    onlySkus: [...onlySkus],
    summary,
    records: results,
  }, null, 2)}\n`);
  fs.writeFileSync(reportPath, toCsv(results));
  console.log(`\nAudit summary: ${JSON.stringify(summary)}`);
  console.log(`Plan: ${planPath}`);
  console.log(`Report: ${reportPath}`);
  console.log('No Airtable records were changed.');
}

async function runCoverageAudit(env, args) {
  const skipSkus = parseSkipSkus(args['skip-skus']);
  const driveToken = await getDriveToken(env);
  const records = await getListingRecords(env);
  const results = [];
  for (const [index, record] of records.entries()) {
    const result = await auditRecord(record, driveToken, skipSkus, new Set(), { compareAll: true });
    results.push(result);
    console.log(`[${index + 1}/${records.length}] SKU ${result.sku || '(missing)'}: ${result.status}`);
  }

  const summary = summarizeCoverage(results);
  const runDir = createRunDirectory();
  const planPath = path.join(runDir, 'coverage.json');
  const reportPath = path.join(runDir, 'coverage.csv');
  fs.writeFileSync(planPath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    source: 'drive-folder-coverage',
    subset: 'listings-page',
    skippedSkus: [...skipSkus],
    sortOrder: 'createdTime-descending',
    summary,
    records: results,
  }, null, 2)}\n`);
  fs.writeFileSync(reportPath, toCoverageCsv(results));
  console.log(`\nCoverage summary: ${JSON.stringify(summary)}`);
  console.log(`Coverage plan: ${planPath}`);
  console.log(`File-level report: ${reportPath}`);
  console.log('Coverage audit is read-only. No Airtable or Drive records were changed.');
}

async function fetchAirtableRecord(env, recordId) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(env.airtableBaseId)}/${encodeURIComponent(env.airtableTableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${env.airtableApiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Airtable record ${recordId} read failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function patchAirtableMetadata(env, recordId, metadata) {
  const url = `https://api.airtable.com/v0/${encodeURIComponent(env.airtableBaseId)}/${encodeURIComponent(env.airtableTableId)}/${encodeURIComponent(recordId)}`;
  const response = await fetchWithRetry(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${env.airtableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: { 'Workflow Image Metadata JSON': JSON.stringify(metadata) },
    }),
  });
  if (!response.ok) {
    throw new Error(`Airtable update for ${recordId} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function runApply(env, args) {
  const planPathArg = args.plan;
  if (typeof planPathArg !== 'string' || !planPathArg.trim()) {
    throw new Error('Apply requires --plan path/to/plan.json.');
  }
  if (args.confirm !== APPLY_CONFIRM_TOKEN) {
    throw new Error(`Apply requires --confirm ${APPLY_CONFIRM_TOKEN}.`);
  }
  const planPath = path.resolve(planPathArg);
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (plan.source !== 'approval-combined' || plan.subset !== 'listings-page' || !Array.isArray(plan.records)) {
    throw new Error('The supplied plan is not a valid Listings-page image sync plan.');
  }

  const readyRecords = plan.records.filter((record) => record.status === 'ready-to-add' && record.addImages?.length);
  if (readyRecords.length === 0) {
    console.log('No verified processed Drive photos are ready to add. No Airtable records were changed.');
    return;
  }
  if (readyRecords.some((record) => record.removeSeededPhotoMetadata)
    && args['replace-seeded-photo-metadata'] !== true) {
    throw new Error('This plan replaces seeded photo placeholders; re-run apply with --replace-seeded-photo-metadata to confirm.');
  }

  for (const planned of readyRecords) {
    const current = await fetchAirtableRecord(env, planned.recordId);
    const fields = current.fields ?? {};
    const currentMetadataValue = typeof fields['Workflow Image Metadata JSON'] === 'string'
      ? fields['Workflow Image Metadata JSON']
      : JSON.stringify(parseMetadata(fields['Workflow Image Metadata JSON']));
    if (currentMetadataValue !== planned.expectedMetadataJson) {
      throw new Error(`Record ${planned.recordId} changed since the audit. Re-run audit before applying.`);
    }
    const currentMetadata = parseMetadata(currentMetadataValue);
    const seededMetadata = planned.removeSeededPhotoMetadata
      ? currentMetadata.filter((item) => item?.sourceStage === 'photos'
        && isSeedImage(asText(item?.filename), planned.sku))
      : [];
    if (planned.removeSeededPhotoMetadata
      && seededMetadata.length !== planned.seededPhotoMetadataCount) {
      throw new Error(`Seeded photo metadata for SKU ${planned.sku} changed since the audit. Re-run audit before applying.`);
    }
    const metadataToPreserve = planned.removeSeededPhotoMetadata
      ? currentMetadata.filter((item) => !(item?.sourceStage === 'photos'
        && isSeedImage(asText(item?.filename), planned.sku)))
      : currentMetadata;
    const currentIds = new Set(metadataToPreserve.map((item) => (
      asText(item?.attachmentId) || getDriveFileId(item?.url)
    )).filter(Boolean));
    const toAdd = planned.addImages.filter((item) => !currentIds.has(item.attachmentId));
    if (toAdd.length === 0 && seededMetadata.length === 0) {
      console.log(`Skipped SKU ${planned.sku}: Drive file IDs already exist.`);
      continue;
    }
    await patchAirtableMetadata(env, planned.recordId, [...metadataToPreserve, ...toAdd]);
    const updated = await fetchAirtableRecord(env, planned.recordId);
    const updatedMetadata = parseMetadata(updated.fields?.['Workflow Image Metadata JSON']);
    const updatedIds = new Set(updatedMetadata.map((item) => (
      asText(item?.attachmentId) || getDriveFileId(item?.url)
    )).filter(Boolean));
    if (toAdd.some((item) => !updatedIds.has(item.attachmentId))) {
      throw new Error(`Airtable readback verification failed for added Drive image metadata on SKU ${planned.sku}.`);
    }
    if (planned.removeSeededPhotoMetadata
      && updatedMetadata.some((item) => item?.sourceStage === 'photos'
        && isSeedImage(asText(item?.filename), planned.sku))) {
      throw new Error(`Airtable readback verification found seeded photo metadata still present for SKU ${planned.sku}.`);
    }
    if (JSON.stringify(updated.fields?.Images ?? [])
      !== JSON.stringify(fields.Images ?? [])) {
      throw new Error(`Airtable legacy Images attachments changed unexpectedly for SKU ${planned.sku}.`);
    }
    console.log(`Updated SKU ${planned.sku}: added ${toAdd.length} processed Drive photo(s), removed ${seededMetadata.length} seed placeholder(s); legacy Images unchanged.`);
  }
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/sync-sku-google-drive-images.mjs audit [--skip-skus 10800] [--only-skus sku1,sku2] [--approve-processed-file-ids id1,id2]');
  console.log('  node scripts/sync-sku-google-drive-images.mjs audit --compare-all [--skip-skus 10800]');
  console.log(`  node scripts/sync-sku-google-drive-images.mjs apply --plan <plan.json> --confirm ${APPLY_CONFIRM_TOKEN} [--replace-seeded-photo-metadata]`);
  console.log('');
  console.log('Audit is read-only. Apply only adds verified Drive photo metadata; it never edits the Airtable Images attachment field.');
  console.log('Unmarked candidates require visual verification of the processed watermark and can only be approved by explicit Drive file ID.');
  console.log('Replacing seed placeholders requires --replace-seeded-photo-metadata; legacy Images attachments are preserved.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args._[0] || 'audit';
  if (args.help || args.h) {
    printUsage();
    return;
  }
  const env = resolveEnv();
  if (mode === 'audit') {
    if (args['compare-all'] === true) {
      await runCoverageAudit(env, args);
    } else {
      await runAudit(env, args);
    }
    return;
  }
  if (mode === 'apply') {
    await runApply(env, args);
    return;
  }
  printUsage();
  throw new Error(`Unsupported mode: ${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
