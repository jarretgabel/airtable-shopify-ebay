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
import { invalidateConfiguredRecordsCache } from './configuredRecordsCache.js';

export const airtableSourceDependencies = {
  createRecord,
  deleteRecord,
  getRecord,
  getRecords,
  getTableMetadata,
  updateRecord,
  uploadAttachment,
};

export type AirtableConfiguredRecordsSource =
  | 'users'
  | 'user-guide'
  | 'inventory-directory'
  | 'used-gear-workflow'
  | 'approval-ebay'
  | 'approval-shopify'
  | 'approval-combined'
  | 'shopify-vendors';
export type AirtableConfiguredWriteSource = AirtableConfiguredRecordsSource;
export type AirtableConfiguredMetadataSource = 'inventory-directory' | 'used-gear-workflow';
export type AirtableConfiguredAttachmentSource = 'inventory-directory' | 'used-gear-workflow';
export type AirtableConfiguredRecordsSubset = 'ready-for-publishing' | 'listings-page';

interface AirtableConfiguredReadOptions {
  fields?: string[];
  filterByFormula?: string;
  subset?: AirtableConfiguredRecordsSubset;
  maxRecords?: number;
}

const LISTINGS_PAGE_MAX_RECORDS = 200;
const UNKNOWN_FIELD_CACHE_TTL_MS = 10 * 60 * 1000;

interface UnknownFieldCacheEntry {
  expiresAt: number;
  fields: Set<string>;
}

const unknownFieldNameCache = new Map<string, UnknownFieldCacheEntry>();

function resolveSubsetFilterByFormula(
  source: AirtableConfiguredRecordsSource,
  subset: AirtableConfiguredRecordsSubset | undefined,
): string | undefined {
  if (!subset) return undefined;

  if (subset === 'ready-for-publishing') {
    if (source !== 'approval-combined') {
      throw new HttpError(400, 'ready-for-publishing subset is only supported for approval-combined.', {
        service: 'airtable',
        code: 'AIRTABLE_SUBSET_NOT_ALLOWED',
        retryable: false,
      });
    }

    return "{Workflow Status}='Approved for Publish'";
  }

  if (subset === 'listings-page') {
    if (source !== 'approval-combined') {
      throw new HttpError(400, 'listings-page subset is only supported for approval-combined.', {
        service: 'airtable',
        code: 'AIRTABLE_SUBSET_NOT_ALLOWED',
        retryable: false,
      });
    }

    return "OR({Workflow Status}='Awaiting Pre-Listing Review', {Workflow Status}='Approved for Publish', {Workflow Status}='Listed, Shopify', {Workflow Status}='Listed, eBay', {Workflow Status}='Stale Listing, Shopify', {Workflow Status}='Stale Listing, eBay')";
  }

  return undefined;
}

function mergeFilterByFormula(
  baseFilter: string | undefined,
  subsetFilter: string | undefined,
): string | undefined {
  const normalizedBase = baseFilter?.trim();
  const normalizedSubset = subsetFilter?.trim();

  if (normalizedBase && normalizedSubset) {
    return `AND(${normalizedBase}, ${normalizedSubset})`;
  }

  return normalizedBase || normalizedSubset;
}

function normalizeRequestedFields(fields?: string[]): string[] | undefined {
  const normalized = fields
    ?.map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!normalized || normalized.length === 0) {
    return undefined;
  }

  return Array.from(new Set(normalized));
}

function buildUnknownFieldCacheKey(baseId: string, tableName: string, viewId: string | undefined): string {
  return `${baseId}::${tableName}::${viewId ?? ''}`;
}

function getCachedUnknownFields(cacheKey: string): Set<string> | null {
  const entry = unknownFieldNameCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    unknownFieldNameCache.delete(cacheKey);
    return null;
  }

  return entry.fields;
}

function rememberUnknownFields(cacheKey: string, fieldNames: string[]): void {
  if (fieldNames.length === 0) {
    return;
  }

  const existing = getCachedUnknownFields(cacheKey);
  const next = new Set(existing ?? []);
  for (const fieldName of fieldNames) {
    if (fieldName.trim()) {
      next.add(fieldName);
    }
  }

  unknownFieldNameCache.set(cacheKey, {
    fields: next,
    expiresAt: Date.now() + UNKNOWN_FIELD_CACHE_TTL_MS,
  });
}

function stripUnknownFields(fields: string[] | undefined, unknownFields: Set<string> | null): string[] | undefined {
  if (!fields || fields.length === 0 || !unknownFields || unknownFields.size === 0) {
    return fields;
  }

  const filtered = fields.filter((fieldName) => !unknownFields.has(fieldName));
  return filtered.length > 0 ? filtered : undefined;
}

function getUnknownFieldNames(error: unknown): string[] {
  if (!(error instanceof HttpError)) {
    return [];
  }

  if (error.statusCode !== 400 && error.statusCode !== 422) {
    return [];
  }

  const message = error.message || '';
  if (!/Unknown field name/i.test(message)) {
    return [];
  }

  const quotedMatches = Array.from(message.matchAll(/['"]([^'"]+)['"]/g))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (quotedMatches.length > 0) {
    return Array.from(new Set(quotedMatches));
  }

  const suffixMatch = message.match(/Unknown field names?:\s*(.+)$/i);
  if (!suffixMatch?.[1]) {
    return [];
  }

  return Array.from(new Set(
    suffixMatch[1]
      .split(',')
      .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
      .filter((value) => value.length > 0),
  ));
}

async function getRecordsWithUnknownFieldFallback(
  baseId: string,
  tableName: string,
  viewId: string | undefined,
  options: AirtableConfiguredReadOptions,
): Promise<AirtableRecord[]> {
  const cacheKey = buildUnknownFieldCacheKey(baseId, tableName, viewId);
  const baseOptions: AirtableConfiguredReadOptions = {
    filterByFormula: options.filterByFormula,
    maxRecords: options.maxRecords,
  };
  let fields = stripUnknownFields(
    normalizeRequestedFields(options.fields),
    getCachedUnknownFields(cacheKey),
  );

  while (true) {
    try {
      return await airtableSourceDependencies.getRecords(baseId, tableName, viewId, {
        ...baseOptions,
        ...(fields ? { fields } : {}),
      });
    } catch (error) {
      const unknownFields = getUnknownFieldNames(error);
      if (unknownFields.length === 0 || !fields || fields.length === 0) {
        throw error;
      }

      rememberUnknownFields(cacheKey, unknownFields);

      const unknownFieldSet = new Set(unknownFields);
      const nextFields = fields.filter((fieldName) => !unknownFieldSet.has(fieldName));
      if (nextFields.length === fields.length) {
        throw error;
      }

      fields = nextFields.length > 0 ? nextFields : undefined;
    }
  }
}

export interface AirtableConfiguredRecordsSummary {
  total: number;
  approved: number;
  pending: number;
}

function getApprovedFieldCandidates(source: AirtableConfiguredRecordsSource): string[] {
  if (source === 'approval-shopify') {
    return ['Shopify Approved', 'Approved'];
  }

  if (source === 'approval-combined') {
    return ['Approved', 'Shopify Approved', 'eBay Approved'];
  }

  return ['Approved', 'eBay Approved', 'Shopify Approved'];
}

function getApprovedFieldValue(record: AirtableRecord, source: AirtableConfiguredRecordsSource): unknown {
  for (const fieldName of getApprovedFieldCandidates(source)) {
    if (fieldName in record.fields) {
      return record.fields[fieldName];
    }
  }

  return undefined;
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
const DEFAULT_USER_GUIDE_TABLE_NAME = 'tblquB9pdwSRXsI7c';
const DEFAULT_APPROVAL_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';
const DEFAULT_COMBINED_LISTINGS_TABLE_NAME = 'tbl0K0nFQL64jQMx8';
const DEFAULT_SHOPIFY_VENDORS_TABLE_REFERENCE = 'apprsAm2FOohEmL2u/tblF0B5TUhy20hJCv/viwx2RONDo3Ii85Gl';
const DEFAULT_SHOPIFY_VENDORS_TABLE_NAME = 'tblF0B5TUhy20hJCv';
const INVENTORY_DIRECTORY_ATTACHMENT_FIELD_IDS = new Set(['fldMXp0EaUHGglU8M']);
const USED_GEAR_WORKFLOW_ATTACHMENT_FIELD_IDS = new Set(['fld1zIzmZEciQECah']);

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
  if (source === 'user-guide') {
    return {
      reference: process.env.AIRTABLE_USER_GUIDE_TABLE_REF?.trim() || process.env.VITE_AIRTABLE_USER_GUIDE_TABLE_REF?.trim(),
      tableName: process.env.AIRTABLE_USER_GUIDE_TABLE_NAME?.trim() || process.env.VITE_AIRTABLE_USER_GUIDE_TABLE_NAME?.trim() || DEFAULT_USER_GUIDE_TABLE_NAME,
    };
  }

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

  if (source === 'shopify-vendors') {
    return {
      reference: process.env.AIRTABLE_SHOPIFY_VENDORS_TABLE_REF?.trim() || DEFAULT_SHOPIFY_VENDORS_TABLE_REFERENCE,
      tableName: process.env.AIRTABLE_SHOPIFY_VENDORS_TABLE_NAME?.trim() || DEFAULT_SHOPIFY_VENDORS_TABLE_NAME,
    };
  }

  if (source === 'used-gear-workflow') {
    return {
      reference: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF?.trim(),
      tableName: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?.trim() || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
    };
  }

  return {
    reference: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_REF?.trim(),
    tableName: process.env.AIRTABLE_COMBINED_LISTINGS_TABLE_NAME?.trim() || DEFAULT_COMBINED_LISTINGS_TABLE_NAME,
  };
}

function getWriteSourceDefinition(source: AirtableConfiguredWriteSource): { reference?: string; tableName: string } {
  return getSourceDefinition(source);
}

function getMetadataSourceDefinition(source: AirtableConfiguredMetadataSource): { baseId: string; tableId: string } {

  const definition = getSourceDefinition(source);

  if (!definition.reference) {
    return {
      baseId: process.env.AIRTABLE_BASE_ID?.trim() || '',
      tableId: definition.tableName,
    };
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );
  const [candidate] = candidates;

  if (!candidate) {
    throw new Error(`Unsupported Airtable metadata source ${source}.`);
  }

  return {
    baseId: candidate.baseId,
    tableId: candidate.tableName,
  };
}

function getAttachmentSourceDefinition(source: AirtableConfiguredAttachmentSource): { baseId: string; allowedFieldIds: Set<string> } {
  const definition = getSourceDefinition(source);
  const allowedFieldIds = source === 'used-gear-workflow'
    ? USED_GEAR_WORKFLOW_ATTACHMENT_FIELD_IDS
    : INVENTORY_DIRECTORY_ATTACHMENT_FIELD_IDS;

  if (!definition.reference) {
    return {
      baseId: process.env.AIRTABLE_BASE_ID?.trim() || '',
      allowedFieldIds,
    };
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );
  const [candidate] = candidates;

  if (!candidate) {
    throw new Error(`Unsupported Airtable attachment source ${source}.`);
  }

  return {
    baseId: candidate.baseId,
    allowedFieldIds,
  };

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
  const subsetFilterByFormula = resolveSubsetFilterByFormula(source, options.subset);
  const mergedFilterByFormula = mergeFilterByFormula(options.filterByFormula, subsetFilterByFormula);
  const readOptions: AirtableConfiguredReadOptions = {
    ...options,
    filterByFormula: mergedFilterByFormula || undefined,
    maxRecords: options.maxRecords ?? (options.subset === 'listings-page' ? LISTINGS_PAGE_MAX_RECORDS : undefined),
  };

  if (!definition.reference) {
    return getRecordsWithUnknownFieldFallback(
      process.env.AIRTABLE_BASE_ID?.trim() || '',
      definition.tableName,
      undefined,
      readOptions,
    );
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await getRecordsWithUnknownFieldFallback(
        candidate.baseId,
        candidate.tableName,
        candidate.viewId,
        readOptions,
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to resolve Airtable source ${source}.`);
}

export async function getConfiguredRecordsSummary(
  source: AirtableConfiguredRecordsSource,
): Promise<AirtableConfiguredRecordsSummary> {
  const records = await getConfiguredRecords(source);
  const approved = records.reduce((count, record) => {
    const approvedValue = getApprovedFieldValue(record, source);
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
    return airtableSourceDependencies.getRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId);
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return await airtableSourceDependencies.getRecord(candidate.baseId, candidate.tableName, recordId);
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
    const createdRecord = await airtableSourceDependencies.createRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, fields, options);
    invalidateConfiguredRecordsCache();
    return createdRecord;
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const createdRecord = await airtableSourceDependencies.createRecord(candidate.baseId, candidate.tableName, fields, options);
      invalidateConfiguredRecordsCache();
      return createdRecord;
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
    const updatedRecord = await airtableSourceDependencies.updateRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId, fields, options);
    invalidateConfiguredRecordsCache();
    return updatedRecord;
  }

  const candidates = parseAirtableReferenceCandidates(
    definition.reference,
    definition.tableName,
    process.env.AIRTABLE_BASE_ID?.trim() || '',
  );

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const updatedRecord = await airtableSourceDependencies.updateRecord(candidate.baseId, candidate.tableName, recordId, fields, options);
      invalidateConfiguredRecordsCache();
      return updatedRecord;
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
    await airtableSourceDependencies.deleteRecord(process.env.AIRTABLE_BASE_ID?.trim() || '', definition.tableName, recordId);
    invalidateConfiguredRecordsCache();
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
      await airtableSourceDependencies.deleteRecord(candidate.baseId, candidate.tableName, recordId);
      invalidateConfiguredRecordsCache();
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
  return airtableSourceDependencies.getTableMetadata(definition.baseId, definition.tableId);
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

  await airtableSourceDependencies.uploadAttachment(definition.baseId, recordId, fieldId, payload);
  invalidateConfiguredRecordsCache();
}