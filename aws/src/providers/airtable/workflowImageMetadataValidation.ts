import { detectSupportedImageMimeType } from '../../shared/imageFormat.js';
import { HttpError } from '../../shared/errors.js';
import { downloadWorkflowImageHeader, getWorkflowImageId } from '../media/workflowImageArchive.js';
import { getConfiguredRecord, updateConfiguredRecord } from './sources.js';

interface WorkflowImageMetadataRecord {
  [key: string]: unknown;
}

export interface WorkflowImageMetadataValidationResult {
  metadataJson: string;
  validImageUrls: string[];
  removedCount: number;
}

export interface WorkflowImageMetadataInspectionResult {
  validImageUrls: string[];
  invalidImageUrls: string[];
}

interface WorkflowImageMetadataValidationDependencies {
  getRecord?: typeof getConfiguredRecord;
  updateRecord?: typeof updateConfiguredRecord;
  downloadFileHeader?: typeof downloadWorkflowImageHeader;
}

function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findMetadataFieldName(fields: Record<string, unknown>): string | null {
  const supportedNames = new Set([
    'workflowimagemetadatajson',
    'workflowimagemetadata',
    'imagemetadatajson',
  ]);
  return Object.keys(fields).find((name) => supportedNames.has(normalizeFieldName(name))) ?? null;
}

function parseMetadataRecords(value: unknown): WorkflowImageMetadataRecord[] {
  if (Array.isArray(value)) {
    if (value.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
      throw new HttpError(400, 'Workflow image metadata contains an invalid record.', {
        service: 'airtable',
        code: 'WORKFLOW_IMAGE_METADATA_INVALID',
        retryable: false,
      });
    }
    return value as WorkflowImageMetadataRecord[];
  }
  if (value === null || value === undefined || value === '') {
    return [];
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Workflow image metadata must be stored as a JSON array.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_METADATA_INVALID',
      retryable: false,
    });
  }
  if (!value.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new HttpError(400, 'Workflow image metadata is not valid JSON and cannot be checked.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_METADATA_INVALID',
      retryable: false,
    });
  }

  if (!Array.isArray(parsed)) {
    throw new HttpError(400, 'Workflow image metadata must be a JSON array.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_METADATA_INVALID',
      retryable: false,
    });
  }
  if (parsed.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new HttpError(400, 'Workflow image metadata contains an invalid record.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_METADATA_INVALID',
      retryable: false,
    });
  }
  return parsed as WorkflowImageMetadataRecord[];
}

function getMetadataUrl(record: WorkflowImageMetadataRecord): string {
  const candidate = record.url ?? record.src ?? record.originalSource ?? record.original_source;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function getWorkflowAttachmentUrls(fields: Record<string, unknown>): string[] {
  const supportedNames = new Set([
    'images',
    'workflowimages',
    'workflowphotos',
    'photographyimages',
    'testingimages',
  ]);
  const attachmentFieldName = Object.keys(fields).find((name) => supportedNames.has(normalizeFieldName(name)));
  if (!attachmentFieldName) return [];

  const raw = fields[attachmentFieldName];
  let entries: unknown[] = Array.isArray(raw) ? raw : [];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed: unknown = JSON.parse(raw);
      entries = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    const directUrl = typeof record.url === 'string' ? record.url.trim() : '';
    const srcUrl = typeof record.src === 'string' ? record.src.trim() : '';
    const thumbnails = record.thumbnails && typeof record.thumbnails === 'object'
      ? record.thumbnails as Record<string, unknown>
      : {};
    const thumbnailUrl = [thumbnails.large, thumbnails.full]
      .map((thumbnail) => (
        thumbnail && typeof thumbnail === 'object' && typeof (thumbnail as Record<string, unknown>).url === 'string'
          ? ((thumbnail as Record<string, unknown>).url as string).trim()
          : ''
      ))
      .find(Boolean) ?? '';
    return [directUrl || srcUrl || thumbnailUrl].filter(Boolean);
  });
}

export async function validateWorkflowImageMetadataRecords(
  records: WorkflowImageMetadataRecord[],
  downloadFileHeader: typeof downloadWorkflowImageHeader = downloadWorkflowImageHeader,
  additionalImageUrls: string[] = [],
): Promise<WorkflowImageMetadataValidationResult> {
  const metadataUrls = records.map(getMetadataUrl);
  const allUrls = [...metadataUrls, ...additionalImageUrls.map((url) => url.trim()).filter(Boolean)];
  const fileIds = Array.from(new Set(allUrls.map(getWorkflowImageId).filter(Boolean)));
  const validityByFileId = new Map<string, boolean>();

  for (let offset = 0; offset < fileIds.length; offset += 4) {
    const batch = fileIds.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(async (fileId) => {
      const file = await downloadFileHeader(fileId);
      return [fileId, detectSupportedImageMimeType(file.bytes) !== null] as const;
    }));
    results.forEach(([fileId, valid]) => validityByFileId.set(fileId, valid));
  }

  const validRecords = records.filter((record, index) => {
    const fileId = getWorkflowImageId(metadataUrls[index] ?? '');
    return Boolean(fileId && validityByFileId.get(fileId));
  });
  const validImageUrls = Array.from(new Set(allUrls.filter((url) => {
    const fileId = getWorkflowImageId(url);
    return Boolean(fileId && validityByFileId.get(fileId));
  })));

  return {
    metadataJson: JSON.stringify(validRecords),
    validImageUrls,
    removedCount: records.length - validRecords.length,
  };
}

async function readWorkflowImageInspection(
  recordId: string,
  dependencies: WorkflowImageMetadataValidationDependencies,
) {
  const getRecord = dependencies.getRecord ?? getConfiguredRecord;
  const downloadFileHeader = dependencies.downloadFileHeader ?? downloadWorkflowImageHeader;
  const record = await getRecord('approval-combined', recordId);
  const metadataFieldName = findMetadataFieldName(record.fields);
  if (!metadataFieldName) {
    throw new HttpError(400, 'This record has no workflow image metadata field to validate.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_METADATA_FIELD_MISSING',
      retryable: false,
    });
  }

  const records = parseMetadataRecords(record.fields[metadataFieldName]);
  const attachmentUrls = getWorkflowAttachmentUrls(record.fields);
  const result = await validateWorkflowImageMetadataRecords(records, downloadFileHeader, attachmentUrls);
  return { metadataFieldName, records, attachmentUrls, result };
}

export async function inspectConfiguredWorkflowImageMetadata(
  recordId: string,
  dependencies: WorkflowImageMetadataValidationDependencies = {},
): Promise<WorkflowImageMetadataInspectionResult> {
  const { records, attachmentUrls, result } = await readWorkflowImageInspection(recordId, dependencies);
  const validUrls = new Set(result.validImageUrls);
  return {
    validImageUrls: result.validImageUrls,
    invalidImageUrls: Array.from(new Set([...records.map(getMetadataUrl), ...attachmentUrls]
      .filter((url) => url && !validUrls.has(url)))),
  };
}

export async function validateConfiguredWorkflowImageMetadata(
  recordId: string,
  dependencies: WorkflowImageMetadataValidationDependencies = {},
): Promise<WorkflowImageMetadataValidationResult> {
  const { metadataFieldName, result } = await readWorkflowImageInspection(recordId, dependencies);
  const updateRecord = dependencies.updateRecord ?? updateConfiguredRecord;
  if (result.removedCount > 0) {
    await updateRecord('approval-combined', recordId, {
      [metadataFieldName]: result.metadataJson,
    }, { typecast: true });
  }

  return result;
}
