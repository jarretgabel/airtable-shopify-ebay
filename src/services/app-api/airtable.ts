import type { AirtableRecord } from '@/types/airtable';
import {
  resolveConfiguredRecordsSource,
  type AirtableConfiguredRecordsSource,
} from './airtableSources';
import { isAppApiHttpError } from './errors';
import { toServiceErrorMessage } from './errors';
import { deleteJson, getJson, patchJson, postJson } from './http';

export type AirtableConfiguredWriteSource =
  | 'users'
  | 'user-guide'
  | 'inventory-directory'
  | 'used-gear-workflow'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined'
  | 'shopify-vendors';
export type AirtableConfiguredMetadataSource = 'inventory-directory' | 'used-gear-workflow';
export type AirtableConfiguredAttachmentSource = 'inventory-directory' | 'used-gear-workflow';

interface AirtableWriteOptions {
  typecast?: boolean;
  timeoutMs?: number;
}

interface AirtableConfiguredReadOptions {
  fields?: string[];
  subset?: 'ready-for-publishing' | 'listings-page';
  maxRecords?: number;
  timeoutMs?: number;
}

const CONFIGURED_RECORDS_READ_TIMEOUT_MS = 45000;

export interface AirtableConfiguredRecordsSummary {
  total: number;
  approved: number;
  pending: number;
}

interface AirtableDeleteResponse {
  deleted: boolean;
}

export interface AirtableMetadataField {
  id: string;
  name: string;
  type: string;
  options?: {
    choices?: Array<{ name: string }>;
  };
}

export type AirtableDriveArchiveStage = 'intake' | 'testing' | 'photos';

export interface AirtableAttachmentUploadDriveArchive {
  stage: AirtableDriveArchiveStage;
  originalFile: File;
}

export interface AirtableArchivedFileReference {
  id: string;
  filename: string;
  url: string;
}

export interface AirtableAttachmentUploadResult {
  uploaded: boolean;
  archived?: boolean;
  archive?: {
    folderId: string;
    original: AirtableArchivedFileReference;
    processed: AirtableArchivedFileReference;
  } | null;
}

export interface AirtableAttachmentUploadOptions {
  archiveOnly?: boolean;
  driveArchive?: AirtableAttachmentUploadDriveArchive;
}

interface AirtableAttachmentUploadPayload {
  filename: string;
  contentType: string;
  file: string;
  archiveOnly?: boolean;
  driveArchive?: {
    stage: AirtableDriveArchiveStage;
    original: AirtableAttachmentUploadPayload;
  };
}

function toAirtableError(error: unknown, tableName: string) {
  return toServiceErrorMessage(
    'airtable',
    'AIRTABLE_GET_RECORDS_FAILED',
    `Failed to load Airtable records from ${tableName}.`,
    error,
    true,
  );
}

function toConfiguredSourceError(error: unknown, source: AirtableConfiguredRecordsSource) {
  const causeMessage = error instanceof Error && error.message.trim().length > 0
    ? ` ${error.message}`
    : '';

  return toServiceErrorMessage(
    'airtable',
    'AIRTABLE_GET_RECORDS_FAILED',
    `Failed to load Airtable records for ${source}.${causeMessage}`,
    error,
    true,
  );
}

function toWriteError(error: unknown): Error {
  if (isAppApiHttpError(error)) {
    return error;
  }

  return error instanceof Error ? error : new Error(String(error));
}

function toAttachmentPayload(file: File, base64: string): AirtableAttachmentUploadPayload {
  return {
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    file: base64,
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Unable to read ${file.name}.`));
        return;
      }

      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export async function getListings(tableName: string, options?: { view?: string }): Promise<AirtableRecord[]> {
  try {
    return await getJson<AirtableRecord[]>('/api/airtable/listings', {
      tableName,
      view: options?.view,
    });
  } catch (error) {
    throw toAirtableError(error, tableName);
  }
}

export async function getConfiguredRecords(
  source: AirtableConfiguredRecordsSource,
  options: AirtableConfiguredReadOptions = {},
): Promise<AirtableRecord[]> {
  try {
    return await getJson<AirtableRecord[]>('/api/airtable/configured-records', {
      source,
      fields: options.fields?.join(',') || undefined,
      subset: options.subset,
      maxRecords: typeof options.maxRecords === 'number' && Number.isFinite(options.maxRecords)
        ? String(Math.trunc(options.maxRecords))
        : undefined,
    }, {
      timeoutMs: options.timeoutMs ?? CONFIGURED_RECORDS_READ_TIMEOUT_MS,
    });
  } catch (error) {
    throw toConfiguredSourceError(error, source);
  }
}

export async function getConfiguredRecordsSummary(
  source: AirtableConfiguredRecordsSource,
): Promise<AirtableConfiguredRecordsSummary> {
  try {
    return await getJson<AirtableConfiguredRecordsSummary>('/api/airtable/configured-records', {
      source,
      summary: 'queue',
    });
  } catch (error) {
    throw toConfiguredSourceError(error, source);
  }
}

export async function getConfiguredRecord(
  source: AirtableConfiguredRecordsSource,
  recordId: string,
): Promise<AirtableRecord> {
  try {
    return await getJson<AirtableRecord>(`/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`);
  } catch (error) {
    throw toConfiguredSourceError(error, source);
  }
}

export async function getRecordsFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
  options: AirtableConfiguredReadOptions = {},
): Promise<AirtableRecord[]> {
  const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);

  if (resolvedSource) {
    return getConfiguredRecords(resolvedSource, options);
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda read path.'), 'approval-ebay');
}

export async function getRecordsSummaryFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
): Promise<AirtableConfiguredRecordsSummary> {
  const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);

  if (resolvedSource) {
    return getConfiguredRecordsSummary(resolvedSource);
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda read path.'), 'approval-ebay');
}

export async function getRecordFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
  recordId: string,
): Promise<AirtableRecord> {
  const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  if (!resolvedSource) {
    throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda read path.'), 'approval-ebay');
  }

  try {
    return await getJson<AirtableRecord>(`/api/airtable/configured-records/${encodeURIComponent(resolvedSource)}/${encodeURIComponent(recordId)}`);
  } catch (error) {
    throw toConfiguredSourceError(error, resolvedSource);
  }
}

export async function createConfiguredRecord(
  source: AirtableConfiguredWriteSource,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  try {
    return await postJson<AirtableRecord>(`/api/airtable/configured-records/${encodeURIComponent(source)}`, {
      fields,
      typecast: options.typecast,
    }, {
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function updateConfiguredRecord(
  source: AirtableConfiguredWriteSource,
  recordId: string,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  try {
    return await patchJson<AirtableRecord>(
      `/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`,
      {
        fields,
        typecast: options.typecast,
      },
      {
        timeoutMs: options.timeoutMs,
      },
    );
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function deleteConfiguredRecord(
  source: AirtableConfiguredWriteSource,
  recordId: string,
): Promise<void> {
  try {
    await deleteJson<AirtableDeleteResponse>(`/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`);
  } catch (error) {
    throw toWriteError(error);
  }
}

function resolveWriteSource(
  tableReference: string | undefined,
  tableName: string | undefined,
): AirtableConfiguredWriteSource | null {
  const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);
  if (!resolvedSource) {
    return null;
  }

  return resolvedSource;
}

export async function createRecordFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  const resolvedSource = resolveWriteSource(tableReference, tableName);

  if (resolvedSource) {
    return createConfiguredRecord(resolvedSource, fields, options);
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda write path.'), 'approval-ebay');
}

export async function updateRecordFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
  recordId: string,
  fields: Record<string, unknown>,
  options: AirtableWriteOptions = {},
): Promise<AirtableRecord> {
  const resolvedSource = resolveWriteSource(tableReference, tableName);

  if (resolvedSource) {
    return updateConfiguredRecord(resolvedSource, recordId, fields, options);
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda write path.'), 'approval-ebay');
}

export async function deleteRecordFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
  recordId: string,
): Promise<void> {
  const resolvedSource = resolveWriteSource(tableReference, tableName);

  if (resolvedSource) {
    await deleteConfiguredRecord(resolvedSource, recordId);
    return;
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda write path.'), 'approval-ebay');
}

export async function getConfiguredFieldMetadata(
  source: AirtableConfiguredMetadataSource,
): Promise<AirtableMetadataField[]> {
  try {
    return await getJson<AirtableMetadataField[]>('/api/airtable/configured-metadata', { source });
  } catch (error) {
    throw toWriteError(error);
  }
}

export async function uploadConfiguredAttachment(
  source: AirtableConfiguredAttachmentSource,
  recordId: string,
  fieldId: string,
  file: File,
  options?: AirtableAttachmentUploadOptions,
): Promise<AirtableAttachmentUploadResult> {
  const base64 = await fileToBase64(file);
  const payload = toAttachmentPayload(file, base64);

  if (options?.archiveOnly) {
    payload.archiveOnly = true;
  }

  if (options?.driveArchive) {
    const originalBase64 = await fileToBase64(options.driveArchive.originalFile);
    payload.driveArchive = {
      stage: options.driveArchive.stage,
      original: toAttachmentPayload(options.driveArchive.originalFile, originalBase64),
    };
  }

  try {
    return await postJson<AirtableAttachmentUploadResult>(
      `/api/airtable/configured-attachments/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldId)}`,
      payload,
    );
  } catch (error) {
    throw toWriteError(error);
  }
}