import { HttpError } from '../../shared/errors.js';
import { detectSupportedImageMimeType } from '../../shared/imageFormat.js';
import type { WorkflowImageArchiveResult } from '../googleDrive/client.js';
import { ARCHIVE_TABLE_PREFIX, buildFilename, safeSegment } from './workflowImageArchive.js';
import type { MediaStore } from './mediaStore.js';

export type DirectUploadStage = 'intake' | 'testing' | 'photos';
type Variant = 'original' | 'processed';

const MAX_BYTES = 40 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff']);

export interface DirectUploadFile {
  variant: Variant;
  filename: string;
  contentType: string;
  size: number;
}

function fail(status: number, code: string, message: string): HttpError {
  return new HttpError(status, message, { service: 'media', code, retryable: false });
}

function assertStage(stage: unknown): DirectUploadStage {
  if (stage === 'intake' || stage === 'testing' || stage === 'photos') return stage;
  throw fail(400, 'WORKFLOW_UPLOAD_STAGE_INVALID', 'stage must be intake, testing or photos.');
}

/** Same key the server-side archive would use, so a direct upload and a base64 upload of one file replace each other. */
function keyFor(recordKey: string, stage: DirectUploadStage, variant: Variant, filename: string): string {
  return `${ARCHIVE_TABLE_PREFIX}/${safeSegment(recordKey, 'unassigned')}/${stage}/${buildFilename(stage, variant, filename)}`;
}

export async function presignWorkflowImageUpload(
  request: { recordKey: string; stage: unknown; files: DirectUploadFile[] },
  media: MediaStore,
): Promise<Array<{ variant: Variant; key: string; uploadUrl: string; contentType: string }>> {
  const stage = assertStage(request.stage);
  const processed = request.files.filter((file) => file.variant === 'processed');
  if (processed.length !== 1 || request.files.length > 2 || request.files.some((file) => file.variant !== 'processed' && file.variant !== 'original')) {
    throw fail(400, 'WORKFLOW_UPLOAD_FILES_INVALID', 'Send one processed file and at most one original file.');
  }
  return Promise.all(request.files.map(async (file) => {
    if (!ALLOWED_TYPES.has(file.contentType) || !file.filename?.trim()) {
      throw fail(400, 'WORKFLOW_UPLOAD_TYPE_INVALID', 'Only image files can be uploaded.');
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) {
      throw fail(400, 'WORKFLOW_UPLOAD_SIZE_INVALID', 'Image size must be between 1 byte and 40 MB.');
    }
    const key = keyFor(request.recordKey, stage, file.variant, file.filename);
    return { variant: file.variant, key, uploadUrl: await media.signedPutUrl(key, file.contentType), contentType: file.contentType };
  }));
}

/** Confirms the uploaded objects exist and are real images, then returns the archive result shape. */
export async function finalizeWorkflowImageUpload(
  request: { recordKey: string; stage: unknown; processedKey: string; originalKey?: string },
  media: MediaStore,
): Promise<WorkflowImageArchiveResult> {
  const stage = assertStage(request.stage);
  const prefix = `${ARCHIVE_TABLE_PREFIX}/${safeSegment(request.recordKey, 'unassigned')}/${stage}/`;
  const check = async (key: string, variant: Variant) => {
    if (!key.startsWith(prefix) || key.slice(prefix.length).includes('/')) {
      throw fail(400, 'WORKFLOW_UPLOAD_KEY_INVALID', `The ${variant} key does not belong to this record.`);
    }
    const header = await media.header(key);
    if (!header || !detectSupportedImageMimeType(header)) {
      throw fail(400, 'WORKFLOW_IMAGE_FORMAT_UNSUPPORTED', `The ${variant} upload is missing or not a supported image file.`);
    }
    return { id: key, filename: key.slice(prefix.length), url: media.publicUrl(key) };
  };
  const processed = await check(request.processedKey, 'processed');
  const original = request.originalKey ? await check(request.originalKey, 'original') : processed;
  return { folderId: prefix.split('/').slice(0, 2).join('/'), original, processed };
}
