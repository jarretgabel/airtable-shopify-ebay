import airtableService from '@/services/airtable';
import type { AirtableRecord } from '@/types/airtable';
import {
  INVENTORY_DIRECTORY_BASE_ID,
  getConfiguredRecordsSourceDefinition,
  resolveConfiguredRecordsSource,
  type AirtableConfiguredRecordsSource,
  INVENTORY_DIRECTORY_TABLE_ID,
} from './airtableSources';
import { isAppApiHttpError } from './errors';
import { toServiceErrorMessage } from './errors';
import { isLambdaAirtableEnabled } from './flags';
import { deleteJson, getJson, patchJson, postJson } from './http';

export type AirtableConfiguredWriteSource =
  | 'users'
  | 'inventory-directory'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined';
export type AirtableConfiguredMetadataSource = 'inventory-directory';
export type AirtableConfiguredAttachmentSource = 'inventory-directory';

interface AirtableWriteOptions {
  typecast?: boolean;
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

interface AirtableAttachmentUploadPayload {
  filename: string;
  contentType: string;
  file: string;
}

function requireAirtableApiKey(): string {
  const apiKey = (import.meta.env.VITE_AIRTABLE_API_KEY as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY.');
  }

  return apiKey;
}

function getMetadataSourceTableId(source: AirtableConfiguredMetadataSource): string {
  if (source === 'inventory-directory') {
    return INVENTORY_DIRECTORY_TABLE_ID;
  }

  throw new Error(`Unsupported Airtable metadata source ${source}.`);
}

function getAttachmentSourceBaseId(source: AirtableConfiguredAttachmentSource): string {
  if (source === 'inventory-directory') {
    return INVENTORY_DIRECTORY_BASE_ID;
  }

  throw new Error(`Unsupported Airtable attachment source ${source}.`);
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
  return toServiceErrorMessage(
    'airtable',
    'AIRTABLE_GET_RECORDS_FAILED',
    `Failed to load Airtable records for ${source}.`,
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
  if (!isLambdaAirtableEnabled()) {
    return airtableService.getRecords(tableName, { view: options?.view });
  }

  try {
    return await getJson<AirtableRecord[]>('/api/airtable/listings', {
      tableName,
      view: options?.view,
    });
  } catch (error) {
    throw toAirtableError(error, tableName);
  }
}

export async function getConfiguredRecords(source: AirtableConfiguredRecordsSource): Promise<AirtableRecord[]> {
  const definition = getConfiguredRecordsSourceDefinition(source);

  if (!isLambdaAirtableEnabled()) {
    if (definition.reference) {
      return airtableService.getRecordsFromReference(definition.reference, definition.tableName);
    }

    return airtableService.getRecords(definition.tableName);
  }

  try {
    return await getJson<AirtableRecord[]>('/api/airtable/configured-records', { source });
  } catch (error) {
    throw toConfiguredSourceError(error, source);
  }
}

export async function getRecordsFromResolvedSource(
  tableReference: string | undefined,
  tableName: string | undefined,
): Promise<AirtableRecord[]> {
  const resolvedSource = resolveConfiguredRecordsSource(tableReference, tableName);

  if (resolvedSource) {
    return getConfiguredRecords(resolvedSource);
  }

  if (!tableReference) {
    throw toConfiguredSourceError(new Error('Airtable table reference is required.'), 'approval-ebay');
  }

  if (!isLambdaAirtableEnabled()) {
    return airtableService.getRecordsFromReference(tableReference, tableName);
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

  if (!isLambdaAirtableEnabled()) {
    return airtableService.getRecordFromReference(tableReference, tableName, recordId);
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
  const definition = getConfiguredRecordsSourceDefinition(source);

  if (!isLambdaAirtableEnabled()) {
    if (definition.reference) {
      return airtableService.createRecordFromReference(definition.reference, definition.tableName, fields, options);
    }

    return airtableService.createRecord(definition.tableName, fields, options);
  }

  try {
    return await postJson<AirtableRecord>(`/api/airtable/configured-records/${encodeURIComponent(source)}`, {
      fields,
      typecast: options.typecast,
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
  const definition = getConfiguredRecordsSourceDefinition(source);

  if (!isLambdaAirtableEnabled()) {
    if (definition.reference) {
      return airtableService.updateRecordFromReference(definition.reference, definition.tableName, recordId, fields, options);
    }

    return airtableService.updateRecord(definition.tableName, recordId, fields, options);
  }

  try {
    return await patchJson<AirtableRecord>(
      `/api/airtable/configured-records/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}`,
      {
        fields,
        typecast: options.typecast,
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
  const definition = getConfiguredRecordsSourceDefinition(source);

  if (!isLambdaAirtableEnabled()) {
    if (definition.reference) {
      await airtableService.deleteRecordFromReference(definition.reference, definition.tableName, recordId);
      return;
    }

    await airtableService.deleteRecord(definition.tableName, recordId);
    return;
  }

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

  if (!isLambdaAirtableEnabled()) {
    return airtableService.createRecordFromReference(tableReference, tableName, fields, options);
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

  if (!isLambdaAirtableEnabled()) {
    return airtableService.updateRecordFromReference(tableReference, tableName, recordId, fields, options);
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

  if (!isLambdaAirtableEnabled()) {
    await airtableService.deleteRecordFromReference(tableReference, tableName, recordId);
    return;
  }

  throw toConfiguredSourceError(new Error('Unsupported Airtable source for Lambda write path.'), 'approval-ebay');
}

export async function getConfiguredFieldMetadata(
  source: AirtableConfiguredMetadataSource,
): Promise<AirtableMetadataField[]> {
  if (!isLambdaAirtableEnabled()) {
    const response = await fetch(`https://api.airtable.com/v0/meta/bases/${INVENTORY_DIRECTORY_BASE_ID}/tables`, {
      headers: {
        Authorization: `Bearer ${requireAirtableApiKey()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to load Airtable metadata (${response.status}).`);
    }

    const data = await response.json() as {
      tables?: Array<{ id: string; fields?: AirtableMetadataField[] }>;
    };
    const table = data.tables?.find((entry) => entry.id === getMetadataSourceTableId(source));
    if (!table) {
      throw new Error('Unable to locate Airtable metadata table.');
    }

    return table.fields ?? [];
  }

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
): Promise<void> {
  const base64 = await fileToBase64(file);
  const payload = toAttachmentPayload(file, base64);

  if (!isLambdaAirtableEnabled()) {
    const response = await fetch(
      `https://content.airtable.com/v0/${getAttachmentSourceBaseId(source)}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldId)}/uploadAttachment`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${requireAirtableApiKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Unable to upload image ${file.name} (${response.status}).`);
    }

    return;
  }

  try {
    await postJson<{ uploaded: true }>(
      `/api/airtable/configured-attachments/${encodeURIComponent(source)}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldId)}`,
      payload,
    );
  } catch (error) {
    throw toWriteError(error);
  }
}