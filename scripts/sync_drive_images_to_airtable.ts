// Script to sync Google Drive images to Airtable Workflow Image Metadata JSON
// Usage: npx tsx scripts/sync_drive_images_to_airtable.ts



// Import requireDriveAccessToken for authenticated requests

// Inline Google Drive token logic from provider
const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
let cachedDriveToken = null;
let pendingDriveTokenPromise = null;

async function requireDriveAccessToken() {
  if (cachedDriveToken && Date.now() < cachedDriveToken.expiresAt) {
    return cachedDriveToken.accessToken;
  }
  if (pendingDriveTokenPromise) {
    return pendingDriveTokenPromise;
  }
  const clientId = process.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Google Drive refresh-token configuration');
  }
  pendingDriveTokenPromise = fetch(GOOGLE_DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Google Drive token request failed (${response.status}): ${detail}`);
      }
      return response.json();
    })
    .then((token) => {
      const accessToken = token.access_token?.trim();
      if (!accessToken) throw new Error('Google Drive token response missing access token');
      cachedDriveToken = {
        accessToken,
        expiresAt: Date.now() + Math.max(60, (token.expires_in ?? 3600) - 60) * 1000,
      };
      return accessToken;
    })
    .finally(() => {
      pendingDriveTokenPromise = null;
    });
  return pendingDriveTokenPromise;
}
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load env vars
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const AIRTABLE_API_KEY = process.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.VITE_AIRTABLE_BASE_ID || 'apprsAm2FOohEmL2u';
const AIRTABLE_TABLE_ID = process.env.VITE_AIRTABLE_COMBINED_LISTINGS_TABLE_NAME || 'tbl0K0nFQL64jQMx8';
const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;
const WORKFLOW_IMAGE_METADATA_FIELD = 'Workflow Image Metadata JSON';

const DRIVE_ROOT_FOLDER_ID = process.env.VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID!;
const GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_DRIVE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET!;
const GOOGLE_REFRESH_TOKEN = process.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN!;

// Helper: Build public image URL (copied from provider)
function buildDrivePublicImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

// Helper: Find the root archive folder ID (inline provider logic)
async function getArchiveRootFolderId(): Promise<string> {
  const configuredRootFolderId = process.env.VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID;
  if (configuredRootFolderId) return configuredRootFolderId;
  // Otherwise, search for the folder by name in root
  const token = await requireDriveAccessToken();
  const params = new URLSearchParams({
    q: `name = 'Workflow Image Archive' and 'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)',
    pageSize: '1',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  if (data.files && data.files[0] && data.files[0].id) return data.files[0].id;
  throw new Error('Could not find Workflow Image Archive root folder');
}

// Helper: List all folders in root (record IDs) using internal provider logic
async function listRecordFolders(): Promise<{ id: string; name: string }[]> {
  const rootFolderId = await getArchiveRootFolderId();
  const params = new URLSearchParams({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '1000',
    supportsAllDrives: 'true',
  });
  const token = await requireDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name }));
}

// Helper: List all images in a folder using internal provider logic
async function listImagesInFolder(folderId: string): Promise<Array<{ id: string; name: string; url: string }>> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '1000',
    supportsAllDrives: 'true',
  });
  const token = await requireDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    url: buildDrivePublicImageUrl(f.id),
  }));
}

// Helper: Download and parse existing metadata JSON
async function fetchAirtableRecord(recordId: string): Promise<any> {
  const res = await axios.get(`${AIRTABLE_API_URL}/${recordId}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  return res.data.fields;
}

// Helper: Update metadata JSON in Airtable
async function updateAirtableMetadata(recordId: string, metadata: any[]) {
  await axios.patch(`${AIRTABLE_API_URL}/${recordId}`, {
    fields: { [WORKFLOW_IMAGE_METADATA_FIELD]: JSON.stringify(metadata) },
  }, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
}

// Helper: Guess stage and type from filename
function guessStageAndType(filename: string): { stage: 'intake' | 'testing' | 'photos'; type: 'original' | 'processed' } {
  const lower = filename.toLowerCase();
  let stage: 'intake' | 'testing' | 'photos' = 'photos';
  if (lower.includes('intake')) stage = 'intake';
  else if (lower.includes('test')) stage = 'testing';
  let type: 'original' | 'processed' = 'original';
  if (lower.includes('processed')) type = 'processed';
  return { stage, type };
}

// Main logic with dry run support
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const folders = await listRecordFolders();
  for (const folder of folders) {
    const recordId = folder.name;
    const images = await listImagesInFolder(folder.id);
    if (images.length === 0) continue;
    const fields = await fetchAirtableRecord(recordId).catch(() => ({}));
    const existing = Array.isArray(fields[WORKFLOW_IMAGE_METADATA_FIELD])
      ? fields[WORKFLOW_IMAGE_METADATA_FIELD]
      : (typeof fields[WORKFLOW_IMAGE_METADATA_FIELD] === 'string' && fields[WORKFLOW_IMAGE_METADATA_FIELD].trim().startsWith('[')
        ? JSON.parse(fields[WORKFLOW_IMAGE_METADATA_FIELD]) : []);
    // Remove all existing intake/testing/photos images (we'll replace)
    const nonImage = existing.filter((img: any) => !['intake', 'testing', 'photos'].includes(img.sourceStage));
    // Build new metadata
    const now = new Date().toISOString();
    const newImages = images.map(img => {
      const { stage, type } = guessStageAndType(img.name);
      return {
        attachmentId: img.id,
        url: img.url,
        filename: img.name,
        alt: '',
        sortOrder: 0, // will set below
        sourceStage: stage,
        includedInListing: false,
        createdAt: now,
        updatedAt: now,
        type,
      };
    });
    // Sort and assign sortOrder
    newImages.sort((a, b) => a.filename.localeCompare(b.filename));
    newImages.forEach((img, i) => { img.sortOrder = i + 1; });
    const nextMetadata = [...nonImage, ...newImages];
    if (dryRun) {
      console.log(`[DRY RUN] Would update ${recordId}: ${newImages.length} images`);
      for (const img of newImages) {
        console.log(`  - ${img.filename} [${img.sourceStage}, ${img.type}] ${img.url}`);
      }
    } else {
      await updateAirtableMetadata(recordId, nextMetadata);
      console.log(`Updated ${recordId}: ${newImages.length} images`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
