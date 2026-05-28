import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const cwd = process.cwd();
const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return dotenv.parse(fs.readFileSync(filePath, 'utf8'));
}

const mergedEnv = {
  ...readEnvFile(path.join(cwd, '.env')),
  ...readEnvFile(path.join(cwd, '.env.local')),
  ...process.env,
};

function requireEnv(name) {
  const value = mergedEnv[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function getAccessToken() {
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

  if (!response.ok) {
    throw new Error(`Failed to mint Google Drive access token: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const token = body.access_token?.trim();
  if (!token) {
    throw new Error('Google token response did not include access_token');
  }

  return token;
}

async function driveRequest(pathOrUrl, token, init = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `https://www.googleapis.com${pathOrUrl}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

async function main() {
  const folderId = requireEnv('VITE_GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID');
  const token = await getAccessToken();

  const folder = await driveRequest(`/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,parents&supportsAllDrives=true`, token, {
    method: 'GET',
  });

  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`Configured root ID ${folderId} is not a Drive folder.`);
  }

  const probeName = `workflow-image-archive-check-${Date.now().toString(36)}.png`;
  const boundary = `drive-check-${Date.now().toString(36)}`;
  const metadata = JSON.stringify({ name: probeName, parents: [folderId] });
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lmRsAAAAASUVORK5CYII=', 'base64');
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`, 'utf8'),
    tinyPng,
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ]);

  const createdProbe = await driveRequest('/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType&supportsAllDrives=true', token, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: new Uint8Array(multipartBody),
  });

  await driveRequest(`/drive/v3/files/${encodeURIComponent(createdProbe.id)}?supportsAllDrives=true`, token, {
    method: 'DELETE',
  });

  console.log('OK  Google Drive refresh-token access verified');
  console.log(`  folder id: ${folder.id}`);
  console.log(`  folder name: ${folder.name}`);
  console.log(`  probe file upload/delete: ${probeName}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});