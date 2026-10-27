import { renameWorkflowImage, updateConfiguredRecord, type AirtableConfiguredAttachmentSource } from '@/services/app-api/airtable';
import { buildImageFilename, type ImageNamingContext } from '@/services/imageNamingFormatter';
import { logServiceError } from '@/services/logger';
import { parseWorkflowImageMetadata, type WorkflowImageMetadataRecord, type WorkflowImageSourceStage } from '@/services/workflowImageMetadata';
import { imageKey } from '@/services/workflowImageStageEdits';

const METADATA_FIELD = 'Workflow Image Metadata JSON';
const HOSTED_URL = /\/api\/media\/used-gear-workflow\//;

interface Identity { attachmentId: string; url: string; filename: string }

export interface RoleRenameResult {
  imageMetadata: WorkflowImageMetadataRecord[];
  originalImageMetadata: WorkflowImageMetadataRecord[] | undefined;
  /** Raw stored metadata JSON, updated when any image was renamed. */
  rawMetadata: unknown;
}

function roleChanged(next: WorkflowImageMetadataRecord, original: WorkflowImageMetadataRecord): boolean {
  return next.imageRole !== original.imageRole || (next.customImageRole ?? '') !== (original.customImageRole ?? '');
}

function withIdentity(record: WorkflowImageMetadataRecord, identity: Identity | undefined): WorkflowImageMetadataRecord {
  return identity ? { ...record, ...identity } : record;
}

/**
 * Renames saved hosted images whose role changed so filenames keep matching the role (SEO).
 * Saves the new identity on the record first, so the normal edit merge sees a consistent record.
 * An image that cannot be renamed keeps its current name.
 */
export async function renameImagesForChangedRoles(params: {
  source: AirtableConfiguredAttachmentSource;
  recordId: string;
  stage: WorkflowImageSourceStage;
  rawMetadata: unknown;
  imageMetadata: WorkflowImageMetadataRecord[];
  originalImageMetadata?: WorkflowImageMetadataRecord[];
  namingContext: ImageNamingContext;
}): Promise<RoleRenameResult> {
  const unchanged = { imageMetadata: params.imageMetadata, originalImageMetadata: params.originalImageMetadata, rawMetadata: params.rawMetadata };
  const originals = params.originalImageMetadata ?? parseWorkflowImageMetadata(params.rawMetadata);
  const originalByKey = new Map(originals.map((record) => [imageKey(record), record]));
  const renames = new Map<string, Identity>();

  for (const next of params.imageMetadata) {
    const original = originalByKey.get(imageKey(next));
    if (next.sourceStage !== params.stage || !original || !next.imageRole || !HOSTED_URL.test(next.url) || !roleChanged(next, original)) continue;
    const { filename } = buildImageFilename(params.namingContext, {
      role: next.imageRole,
      customRole: next.imageRole === 'custom' ? next.customImageRole ?? '' : '',
    });
    try {
      const renamed = await renameWorkflowImage(params.source, params.recordId, next.url, filename);
      if (renamed && renamed.url !== next.url) {
        renames.set(imageKey(next), { attachmentId: renamed.id, url: renamed.url, filename: renamed.filename });
      }
    } catch (error) {
      logServiceError('workflowImageRename', 'Unable to rename workflow image; keeping its current filename', error);
    }
  }
  if (renames.size === 0) return unchanged;

  let entries: unknown;
  try {
    entries = typeof params.rawMetadata === 'string' ? JSON.parse(params.rawMetadata) : params.rawMetadata;
  } catch {
    return unchanged;
  }
  if (!Array.isArray(entries)) return unchanged;

  const patched = entries.map((entry) => {
    const record = parseWorkflowImageMetadata([entry])[0];
    const identity = record ? renames.get(imageKey(record)) : undefined;
    if (!identity) return entry;
    const nextEntry = { ...(entry as Record<string, unknown>), ...identity, updatedAt: new Date().toISOString() };
    for (const alias of ['src', 'originalSource', 'original_source', 'attachment_id', 'name']) delete (nextEntry as Record<string, unknown>)[alias];
    return nextEntry;
  });
  const rawMetadata = JSON.stringify(patched);
  await updateConfiguredRecord(params.source, params.recordId, { [METADATA_FIELD]: rawMetadata }, { typecast: true });

  const remap = (records: WorkflowImageMetadataRecord[]) => records.map((record) => withIdentity(record, renames.get(imageKey(record))));
  return {
    imageMetadata: remap(params.imageMetadata),
    originalImageMetadata: params.originalImageMetadata ? remap(params.originalImageMetadata) : params.originalImageMetadata,
    rawMetadata,
  };
}
