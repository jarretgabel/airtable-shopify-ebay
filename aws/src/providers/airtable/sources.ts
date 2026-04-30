import { HttpError } from '../../shared/errors.js';
import {
  createRecord,
  deleteRecord,
  getRecord,
  getRecords,
  getTableMetadata,
  type AirtableMetadataField,
  type AirtableRecord,
  updateRecord,
  uploadAttachment,
} from './client.js';
import { parseAirtableReferenceCandidates } from './reference.js';

export type AirtableConfiguredRecordsSource =
  | 'users'
  | 'inventory-directory'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined';
export type AirtableConfiguredWriteSource = AirtableConfiguredRecordsSource;
export type AirtableConfiguredMetadataSource = 'inventory-directory';
export type AirtableConfiguredAttachmentSource = 'inventory-directory';

interface AirtableConfiguredReadOptions {
  fields?: string[];
}

export interface AirtableConfiguredRecordsSummary {
  total: number;
  approved: number;
  pending: number;
}

function isApprovedValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'approved';
  }

  return false;
}

const DEFAULT_USERS_TABLE_NAME = 'j2Gt9USORo6Vi5';
const DEFAULT_APPROVAL_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';
const DEFAULT_COMBINED_LISTINGS_TABLE_NAME = 'tbl0K0nFQL64jQMx8';
const INVENTORY_DIRECTORY_BASE_ID = 'appjQj8FQfFZ2ogMz';
const INVENTORY_DIRECTORY_TABLE_ID = 'tblirsoRIFPDMHxb0';
const INVENTORY_DIRECTORY_TABLE_NAME = 'SB Inventory';
const INVENTORY_DIRECTORY_TABLE_REFERENCE = `${INVENTORY_DIRECTORY_BASE_ID}/${INVENTORY_DIRECTORY_TABLE_ID}`;
const INVENTORY_DIRECTORY_ATTACHMENT_FIELD_IDS = new Set(['fldMXp0EaUHGglU8M']);

function resolveUsersSource(): { reference?: string; tableName: string } {
  const tableReference = process.env.AIRTABLE_USERS_TABLE_REF?.trim();
  const tableName = process.env.AIRTABLE_USERS_TABLE_NAME?.trim() || DEFAULT_USERS_TABLE_NAME;

  if (tableReference && !tableReference.includes('/')) {
    return { tableName: tableReference };
  }

  return {
    reference: tableReference,
    tableName,
  };
}

function getSourceDefinition(source: AirtableConfiguredRecordsSource): { reference?: string; tableName: string } {
  if (source === 'users') {
    return resolveUsersSource();
  }

  if (source === 'approval-ebay') {
    return {
      reference: process.env.AIRTABLE_APPROVAL_TABLE_REF?.trim() || DEFAULT_APPROVAL_TABLE_REFERENCE,
      tableName:
        process.env.AIRTABLE_APPROVAL_TABLE_NAME?.trim()
        || process.env.AIRTABLE_TABLE_NAME?.trim()
        || '',
    };
  }

  if (source === 'approval-shopify') {
    return {
      reference: process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_REF?.trim(),
      tableName: process.env.AIRTABLE_SHOPIFY_APPROVAL_TABLE_NAME?.trim() || '',
    };
  }

  if (source === 'approval-combined') {
    return {
      reference: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF?.trim(),
      tableName: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?.trim() || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
    };
  }

  return {
    reference: INVENTORY_DIRECTORY_TABLE_REFERENCE,
    tableName: INVENTORY_DIRECTORY_TABLE_NAME,
  };
}

function getWriteSourceDefinition(source: AirtableConfiguredWriteSource): { reference?: string; tableName: string } {
  return getSourceDefinition(source);
}

function getMetadataSourceDefinition(source: AirtableConfiguredMetadataSource): { baseId: string; tableId: string } {
  if (source === 'inventory-directory') {
    return {
      baseId: INVENTORY_DIRECTORY_BASE_ID,
      tableId: INVENTORY_DIRECTORY_TABLE_ID,
    };
  }

  throw new Error(`Unsupported Airtable metadata source ${source}.`);
}

function getAttachmentSourceDefinition(source: AirtableConfiguredAttachmentSource): { baseId: string; allowedFieldIds: Set<string> } {
  if (source === 'inventory-directory') {
    return {
      baseId: INVENTORY_DIRECTORY_BASE_ID,
      allowedFieldIds: INVENTORY_DIRECTORY_ATTACHMENT_FIELD_IDS,
    };
  }

  throw new Error(`Unsupported Airtable attachment source ${source}.`);
}

function isRetryableReferenceError(error: unknown): boolean {
  return error instanceof HttpError
    && (error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 404);
}

export async function getConfiguredRecords(
  source: AirtableConfiguredRecordsSource,
  options: AirtableConfiguredReadOptions = {},
): Promise<AirtableRecord[]> {
  const definition = getSourceDefinition(source);

  if (!definition.reference) {
    return getRecords(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, undefined, options);
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await getRecords(candidate.baseId, candidate.tableName, candidate.viewId, options);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to resolve Airtable source ${source}.`);
}

export async function getConfiguredRecordsSummary(
  source: AirtableConfiguredRecordsSource,
): Promise<AirtableConfiguredRecordsSummary> {
  const records = await getConfiguredRecords(source, { fields: ['Approved'] });
  const approved = records.reduce((count, record) => {
    const approvedValue = record.fields.Approved;
    return count + (isApprovedValue(approvedValue) ? 1 : 0);
  }, 0);

  return {
    total: records.length,
    approved,
    pending: Math.max(0, records.length - approved),
  };
}

export async function getConfiguredRecord(
  source: AirtableConfiguredRecordsSource,
  recordId: string,
): Promise<AirtableRecord> {
  const definition = getSourceDefinition(source);

  if (!definition.reference) {
    return getRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId);
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await getRecord(candidate.baseId, candidate.tableName, recordId);
    } catch (error) {
      lastError = error;
      if (!isRetryableReferenceError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to resolve Airtable record for source ${source}.`);
}

export async function createConfiguredRecord(
  source: AirtableConfiguredWriteSource,
  fields: Record<string, unknown>,
  options: { typecast?: boolean } = {},
): Promise<AirtableRecord> {
  const definition = getWriteSourceDefinition(source);

  if (!definition.reference) {
    return createRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, fields, options);
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await createRecord(candidate.baseId, candidate.tableName, fields, options);
    } catch (error) {
      lastError = error;
      if (!isRetryableReferenceError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to create Airtable record for source ${source}.`);
}

export async function updateConfiguredRecord(
  source: AirtableConfiguredWriteSource,
  recordId: string,
  fields: Record<string, unknown>,
  options: { typecast?: boolean } = {},
): Promise<AirtableRecord> {
  const definition = getWriteSourceDefinition(source);

  if (!definition.reference) {
    return updateRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId, fields, options);
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await updateRecord(candidate.baseId, candidate.tableName, recordId, fields, options);
    } catch (error) {
      lastError = error;
      if (!isRetryableReferenceError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to update Airtable record for source ${source}.`);
}

export async function deleteConfiguredRecord(source: AirtableConfiguredWriteSource, recordId: string): Promise<void> {
  const definition = getWriteSourceDefinition(source);

  if (!definition.reference) {
    await deleteRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId);
    return;
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      await deleteRecord(candidate.baseId, candidate.tableName, recordId);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableReferenceError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error(`Unable to delete Airtable record for source ${source}.`);
}

export async function getConfiguredFieldMetadata(source: AirtableConfiguredMetadataSource): Promise<AirtableMetadataField[]> {
  const definition = getMetadataSourceDefinition(source);
  return getTableMetadata(definition.baseId, definition.tableId);
}

export async function uploadConfiguredAttachment(
  source: AirtableConfiguredAttachmentSource,
  recordId: string,
  fieldId: string,
  payload: { filename: string; contentType: string; file: string },
): Promise<void> {
  const definition = getAttachmentSourceDefinition(source);

  if (!definition.allowedFieldIds.has(fieldId)) {
    throw new HttpError(400, 'Unsupported Airtable attachment field', {
      service: 'airtable',
      code: 'AIRTABLE_ATTACHMENT_FIELD_NOT_ALLOWED',
      retryable: false,
    });
  }

  await uploadAttachment(definition.baseId, recordId, fieldId, payload);
}