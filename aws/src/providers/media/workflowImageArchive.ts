import { HttpError } from '../../shared/errors.js';
import { detectSupportedImageMimeType } from '../../shared/imageFormat.js';
import type { WorkflowImageArchiveRequest, WorkflowImageArchiveResult } from './workflowImageTypes.js';
import { extractWorkflowMediaKey, getMediaStoreFromEnv, type MediaStore } from './mediaStore.js';

export const ARCHIVE_TABLE_PREFIX = 'used-gear-workflow';

/** Keeps S3 keys within the media route's allowed characters. */
export function safeSegment(value: string, fallback: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+\./g, '.').replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || fallback;
}

export function buildFilename(stage: string, variant: 'original' | 'processed', filename: string): string {
  const trimmed = safeSegment(filename, 'image.jpg');
  const extension = trimmed.match(/\.[^.]+$/)?.[0] ?? '';
  const stem = extension ? trimmed.slice(0, -extension.length) : trimmed;
  return variant === 'original' ? `${stage}--${stem}--original${extension}` : `${stage}--${trimmed}`;
}

function decodeImage(payload: { file: string }, variant: 'original' | 'processed'): { bytes: Buffer; contentType: string } {
  const bytes = Buffer.from(payload.file, 'base64');
  const contentType = detectSupportedImageMimeType(bytes);
  if (!contentType) {
    throw new HttpError(400, `The ${variant} workflow upload is not a supported image file.`, {
      service: 'media',
      code: 'WORKFLOW_IMAGE_FORMAT_UNSUPPORTED',
      retryable: false,
    });
  }
  return { bytes, contentType };
}

/** Keys are stable, so re-uploads replace the file. */
export async function archiveWorkflowImagesToS3(
  request: WorkflowImageArchiveRequest,
  media: MediaStore,
): Promise<WorkflowImageArchiveResult> {
  const processed = decodeImage(request.processed, 'processed');
  const original = request.original.file ? decodeImage(request.original, 'original') : null;
  const folderKey = safeSegment(request.folderKey, 'unassigned');
  const prefix = `${ARCHIVE_TABLE_PREFIX}/${folderKey}/${request.stage}`;

  const put = async (variant: 'original' | 'processed', filename: string, bytes: Buffer, contentType: string) => {
    const name = buildFilename(request.stage, variant, filename);
    const key = `${prefix}/${name}`;
    await media.put(key, bytes, contentType);
    return { id: key, filename: name, url: media.publicUrl(key) };
  };

  const processedFile = await put('processed', request.processed.filename, processed.bytes, processed.contentType);
  const originalFile = original
    ? await put('original', request.original.filename, original.bytes, original.contentType)
    : processedFile;

  return { folderId: `${ARCHIVE_TABLE_PREFIX}/${folderKey}`, original: originalFile, processed: processedFile };
}

export async function archiveWorkflowImages(request: WorkflowImageArchiveRequest): Promise<WorkflowImageArchiveResult> {
  const media = getMediaStoreFromEnv();
  if (!media) {
    throw new HttpError(503, 'Image storage is not configured.', {
      service: 'media',
      code: 'MEDIA_STORE_NOT_CONFIGURED',
      retryable: false,
    });
  }
  return archiveWorkflowImagesToS3(request, media);
}

/** Storage key used to validate a hosted workflow image. */
export function getWorkflowImageId(url: string): string {
  return extractWorkflowMediaKey(url);
}

/** Header bytes for a hosted image key. A missing object yields empty bytes, so it fails the image check. */
export async function downloadWorkflowImageHeader(
  imageId: string,
  media: MediaStore | null = getMediaStoreFromEnv(),
): Promise<{ bytes: Buffer; contentType: string | null }> {
  const bytes = media && imageId.startsWith(`${ARCHIVE_TABLE_PREFIX}/`) ? await media.header(imageId) : null;
  return { bytes: bytes ?? Buffer.alloc(0), contentType: null };
}
