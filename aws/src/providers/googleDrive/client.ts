import { HttpError } from '../../shared/errors.js';
import { getOptionalSecret, requireSecret } from '../../shared/secrets.js';

export type WorkflowImageArchiveStage = 'testing' | 'photos';

interface GoogleDriveArchiveFilePayload {
  filename: string;
  contentType: string;
  file: string;
}

export interface WorkflowImageArchiveRequest {
  sku: string;
  stage: WorkflowImageArchiveStage;
  original: GoogleDriveArchiveFilePayload;
  processed: GoogleDriveArchiveFilePayload;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
}

export interface ArchivedWorkflowImageFile {
  id: string;
  filename: string;
  url: string;
}

export interface WorkflowImageArchiveResult {
  folderId: string;
  original: ArchivedWorkflowImageFile;
  processed: ArchivedWorkflowImageFile;
}

interface GoogleDriveListResponse {
  files?: GoogleDriveFile[];
}

interface GoogleDriveTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface CachedGoogleDriveToken {
  accessToken: string;
  expiresAt: number;
}

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_DEFAULT_ARCHIVE_ROOT_FOLDER_NAME = 'Workflow Image Archive';
const GOOGLE_DRIVE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedDriveToken: CachedGoogleDriveToken | null = null;
let pendingDriveTokenPromise: Promise<string> | null = null;

async function requestDriveAccessToken(): Promise<GoogleDriveTokenResponse> {
  const response = await fetch(GOOGLE_DRIVE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: requireSecret('GOOGLE_DRIVE_CLIENT_ID'),
      client_secret: requireSecret('GOOGLE_DRIVE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: requireSecret('GOOGLE_DRIVE_REFRESH_TOKEN'),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(response.status, `Google Drive token request failed (${response.status}): ${detail}`, {
      service: 'google-drive',
      code: 'GOOGLE_DRIVE_TOKEN_REQUEST_FAILED',
      retryable: response.status >= 500,
    });
  }

  return await response.json() as GoogleDriveTokenResponse;
}

async function requireDriveAccessToken(): Promise<string> {
  if (cachedDriveToken && Date.now() < cachedDriveToken.expiresAt) {
    return cachedDriveToken.accessToken;
  }

  if (pendingDriveTokenPromise) {
    return pendingDriveTokenPromise;
  }

  const hasRefreshTokenConfig = Boolean(
    getOptionalSecret('GOOGLE_DRIVE_CLIENT_ID')
    && getOptionalSecret('GOOGLE_DRIVE_CLIENT_SECRET')
    && getOptionalSecret('GOOGLE_DRIVE_REFRESH_TOKEN'),
  );

  if (!hasRefreshTokenConfig) {
    throw new HttpError(500, 'Missing Google Drive refresh-token configuration', {
      service: 'google-drive',
      code: 'GOOGLE_DRIVE_NOT_CONFIGURED',
      retryable: false,
    });
  }

  pendingDriveTokenPromise = requestDriveAccessToken()
    .then((token) => {
      const accessToken = token.access_token?.trim();
      if (!accessToken) {
        throw new HttpError(500, 'Google Drive token response missing access token', {
          service: 'google-drive',
          code: 'GOOGLE_DRIVE_TOKEN_RESPONSE_INVALID',
          retryable: false,
        });
      }

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

function getConfiguredDriveRootFolderId(): string | undefined {
  return getOptionalSecret('GOOGLE_DRIVE_IMAGE_ARCHIVE_ROOT_FOLDER_ID');
}

function normalizeSkuFolderName(sku: string): string {
  const trimmed = sku.trim();
  if (!trimmed) {
    throw new HttpError(400, 'SKU is required to archive workflow images in Google Drive', {
      service: 'google-drive',
      code: 'GOOGLE_DRIVE_SKU_REQUIRED',
      retryable: false,
    });
  }

  return trimmed.replace(/[\\/:*?"<>|]+/g, '-');
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function driveRequest<T>(url: string, init: RequestInit, fallbackCode: string): Promise<T> {
  const token = await requireDriveAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new HttpError(response.status, `Google Drive request failed (${response.status}): ${detail}`, {
      service: 'google-drive',
      code: fallbackCode,
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return await response.json() as T;
}

async function findFileByName(parentId: string, name: string, mimeType?: string): Promise<GoogleDriveFile | undefined> {
  const queryParts = [
    `name = '${escapeDriveQueryValue(name)}'`,
    `'${escapeDriveQueryValue(parentId)}' in parents`,
    'trashed = false',
  ];

  if (mimeType) {
    queryParts.push(`mimeType = '${escapeDriveQueryValue(mimeType)}'`);
  }

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    fields: 'files(id,name,mimeType,webViewLink)',
    pageSize: '1',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const response = await driveRequest<GoogleDriveListResponse>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    { method: 'GET' },
    'GOOGLE_DRIVE_LIST_FAILED',
  );

  return response.files?.[0];
}

async function createFolder(parentId: string, folderName: string): Promise<string> {
  const createdFolder = await driveRequest<GoogleDriveFile>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
        parents: [parentId],
      }),
    },
    'GOOGLE_DRIVE_CREATE_FOLDER_FAILED',
  );

  return createdFolder.id;
}

async function ensureArchiveRootFolder(): Promise<string> {
  const configuredRootFolderId = getConfiguredDriveRootFolderId();
  if (configuredRootFolderId) {
    return configuredRootFolderId;
  }

  const existingFolder = await findFileByName('root', GOOGLE_DRIVE_DEFAULT_ARCHIVE_ROOT_FOLDER_NAME, GOOGLE_DRIVE_FOLDER_MIME_TYPE);
  if (existingFolder) {
    return existingFolder.id;
  }

  return await createFolder('root', GOOGLE_DRIVE_DEFAULT_ARCHIVE_ROOT_FOLDER_NAME);
}

async function ensureSkuFolder(sku: string): Promise<string> {
  const rootFolderId = await ensureArchiveRootFolder();
  const folderName = normalizeSkuFolderName(sku);
  const existingFolder = await findFileByName(rootFolderId, folderName, GOOGLE_DRIVE_FOLDER_MIME_TYPE);
  if (existingFolder) {
    return existingFolder.id;
  }

  return await createFolder(rootFolderId, folderName);
}

function buildArchiveFilename(stage: WorkflowImageArchiveStage, variant: 'original' | 'processed', filename: string): string {
  const trimmed = filename.trim() || 'image.jpg';
  const extensionMatch = trimmed.match(/\.[^.]+$/);
  const extension = extensionMatch?.[0] ?? '';
  const stem = extension ? trimmed.slice(0, -extension.length) : trimmed;

  if (variant === 'original') {
    return `${stage}--${stem}--original${extension}`;
  }

  return `${stage}--${trimmed}`;
}

function buildMultipartBody(metadata: Record<string, unknown>, fileBase64: string, contentType: string, boundary: string): Buffer {
  const fileBuffer = Buffer.from(fileBase64, 'base64');
  const prefix = Buffer.from(
    `--${boundary}\r\n`
    + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
    + `${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\n`
    + `Content-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`,
    'utf8',
  );
  const suffix = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  return Buffer.concat([prefix, fileBuffer, suffix]);
}

async function upsertFileInFolder(
  folderId: string,
  filename: string,
  contentType: string,
  fileBase64: string,
): Promise<GoogleDriveFile> {
  const existingFile = await findFileByName(folderId, filename);
  const boundary = `drive-upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const metadata: Record<string, unknown> = { name: filename };
  if (!existingFile) {
    metadata.parents = [folderId];
  }

  const body = new Uint8Array(buildMultipartBody(metadata, fileBase64, contentType, boundary));
  const url = existingFile
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFile.id)}?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true';

  return await driveRequest<GoogleDriveFile>(
    url,
    {
      method: existingFile ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
    existingFile ? 'GOOGLE_DRIVE_UPDATE_FILE_FAILED' : 'GOOGLE_DRIVE_UPLOAD_FILE_FAILED',
  );
}

function buildDrivePublicImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

async function ensurePublicReadAccess(fileId: string): Promise<void> {
  await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    },
    'GOOGLE_DRIVE_SET_FILE_PERMISSION_FAILED',
  );
}

export async function archiveWorkflowImagesToGoogleDrive(request: WorkflowImageArchiveRequest): Promise<WorkflowImageArchiveResult> {
  const folderId = await ensureSkuFolder(request.sku);

  const originalFile = await upsertFileInFolder(
    folderId,
    buildArchiveFilename(request.stage, 'original', request.original.filename),
    request.original.contentType,
    request.original.file,
  );

  const processedFile = await upsertFileInFolder(
    folderId,
    buildArchiveFilename(request.stage, 'processed', request.processed.filename),
    request.processed.contentType,
    request.processed.file,
  );

  await ensurePublicReadAccess(processedFile.id);

  return {
    folderId,
    original: {
      id: originalFile.id,
      filename: originalFile.name,
      url: buildDrivePublicImageUrl(originalFile.id),
    },
    processed: {
      id: processedFile.id,
      filename: processedFile.name,
      url: buildDrivePublicImageUrl(processedFile.id),
    },
  };
}
