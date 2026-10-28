import { HttpError } from '../../shared/errors.js';
import { detectSupportedImageMimeType } from '../../shared/imageFormat.js';
import type { WorkflowImageArchiveResult } from './workflowImageTypes.js';
import { ARCHIVE_TABLE_PREFIX, buildFilename, safeSegment } from './workflowImageArchive.js';
import { IMAGE_VARIANT_WIDTHS, parseVariantWidth, variantKey, type ImageVariantWidth } from './imageVariants.js';
import { extractWorkflowMediaKey, type MediaStore } from './mediaStore.js';

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
  return (await presignWorkflowImageUploadWithVariants(request, media)).uploads;
}

/** Also returns signed URLs for the smaller JPEG variants of the processed file. */
export async function presignWorkflowImageUploadWithVariants(
  request: { recordKey: string; stage: unknown; files: DirectUploadFile[]; variantWidths?: number[] },
  media: MediaStore,
): Promise<{
  uploads: Array<{ variant: Variant; key: string; uploadUrl: string; contentType: string }>;
  variantUploads: Array<{ width: ImageVariantWidth; key: string; uploadUrl: string; contentType: string }>;
}> {
  const stage = assertStage(request.stage);
  const processed = request.files.filter((file) => file.variant === 'processed');
  if (processed.length !== 1 || request.files.length > 2 || request.files.some((file) => file.variant !== 'processed' && file.variant !== 'original')) {
    throw fail(400, 'WORKFLOW_UPLOAD_FILES_INVALID', 'Send one processed file and at most one original file.');
  }
  const uploads = await Promise.all(request.files.map(async (file) => {
    if (!ALLOWED_TYPES.has(file.contentType) || !file.filename?.trim()) {
      throw fail(400, 'WORKFLOW_UPLOAD_TYPE_INVALID', 'Only image files can be uploaded.');
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_BYTES) {
      throw fail(400, 'WORKFLOW_UPLOAD_SIZE_INVALID', 'Image size must be between 1 byte and 40 MB.');
    }
    const key = keyFor(request.recordKey, stage, file.variant, file.filename);
    return { variant: file.variant, key, uploadUrl: await media.signedPutUrl(key, file.contentType), contentType: file.contentType };
  }));
  const processedKey = uploads.find((upload) => upload.variant === 'processed')?.key ?? '';
  const widths = [...new Set((request.variantWidths ?? []).map((width) => parseVariantWidth(String(width))).filter((width): width is ImageVariantWidth => width !== null))];
  const variantUploads = await Promise.all(widths.map(async (width) => {
    const key = variantKey(processedKey, width);
    return { width, key, uploadUrl: await media.signedPutUrl(key, 'image/jpeg'), contentType: 'image/jpeg' };
  }));
  return { uploads, variantUploads };
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

/** Copies a stored image to a new SEO filename in the same folder. The old object stays so published URLs keep resolving. */
export async function renameWorkflowImage(
  request: { url: string; filename: string },
  media: MediaStore,
): Promise<{ id: string; filename: string; url: string }> {
  const key = extractWorkflowMediaKey(request.url) || (request.url.startsWith(`${ARCHIVE_TABLE_PREFIX}/`) ? request.url : '');
  const parts = key.split('/');
  if (parts.length !== 4) throw fail(400, 'WORKFLOW_RENAME_KEY_INVALID', 'The image is not stored in the workflow media bucket.');
  const stage = assertStage(parts[2]);
  const folder = parts.slice(0, 3).join('/');
  if (!request.filename?.trim()) throw fail(400, 'WORKFLOW_RENAME_NAME_INVALID', 'A new filename is required.');

  const wanted = buildFilename(stage, 'processed', request.filename);
  if (wanted === parts[3]) return { id: key, filename: wanted, url: media.publicUrl(key) };

  const extension = wanted.match(/\.[^.]+$/)?.[0] ?? '';
  const stem = extension ? wanted.slice(0, -extension.length) : wanted;
  let name = wanted;
  for (let attempt = 2; await media.header(`${folder}/${name}`, 1); attempt += 1) {
    if (attempt > 50) throw fail(409, 'WORKFLOW_RENAME_CONFLICT', 'Could not find a free filename.');
    name = `${stem}-${attempt}${extension}`;
  }
  const nextKey = `${folder}/${name}`;
  await media.copy(key, nextKey);
  for (const width of IMAGE_VARIANT_WIDTHS) {
    if (await media.header(variantKey(key, width), 1)) await media.copy(variantKey(key, width), variantKey(nextKey, width));
  }
  return { id: nextKey, filename: name, url: media.publicUrl(nextKey) };
}
