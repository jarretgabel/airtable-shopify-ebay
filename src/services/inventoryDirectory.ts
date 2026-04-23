import { requireEnv } from '@/config/runtimeEnv';
import type { InventoryDirectoryData, InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import airtableService from '@/services/airtable/service';
import type { AirtableRecord } from '@/types/airtable';

const TARGET_BASE_ID = 'appjQj8FQfFZ2ogMz';
const TARGET_TABLE_ID = 'tblirsoRIFPDMHxb0';
const TARGET_TABLE_NAME = 'SB Inventory';
const TARGET_TABLE_REFERENCE = `${TARGET_BASE_ID}/${TARGET_TABLE_ID}`;
const PRIORITY_FIELD_ORDER = [
  'SKU',
  'Status',
  'Make',
  'Model',
  'Component Type',
  'Cost',
  'Price',
  'Acquired From',
  'Arrival Date',
  'Audiogon Rating',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Serial Number',
  'Voltage',
  'Additional Items',
  'Inventory Notes',
  'Cosmetic Condition Notes',
  'Testing Notes',
  'Testing Time',
  'Service Notes',
  'Service Time',
  'Shipping Weight',
  'Shipping Dims',
  'Shipping Method',
  'Tested',
  "Photo'd",
];

const EDITABLE_TYPES = new Set([
  'barcode',
  'checkbox',
  'currency',
  'date',
  'duration',
  'email',
  'multilineText',
  'multipleSelects',
  'number',
  'percent',
  'phoneNumber',
  'singleLineText',
  'singleSelect',
  'url',
]);

const TEXT_TYPES = new Set(['barcode', 'email', 'phoneNumber', 'singleLineText', 'url']);
const TEXTAREA_TYPES = new Set(['multilineText']);
const NUMERIC_TYPES = new Set(['currency', 'duration', 'number', 'percent']);
const SINGLE_VALUE_MULTIPLE_SELECT_FIELDS = new Set([
  'Component Type',
  'Audiogon Rating',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Shipping Method',
]);
const MINUTE_DURATION_FIELDS = new Set(['Testing Time', 'Service Time']);

interface AirtableMetadataField {
  id: string;
  name: string;
  type: string;
  options?: {
    choices?: Array<{ name: string }>;
  };
}

interface AirtableMetadataTable {
  id: string;
  fields: AirtableMetadataField[];
}

interface AirtableMetadataResponse {
  tables?: AirtableMetadataTable[];
}

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function extractInventoryScalarValue(value: unknown): string {
  if (value == null) return '';

  if (Array.isArray(value)) {
    const firstValue = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return firstValue ?? '';
  }

  if (typeof value === 'object') {
    const textValue = 'text' in value && typeof value.text === 'string' ? value.text.trim() : '';
    if (textValue) return textValue;

    const nameValue = 'name' in value && typeof value.name === 'string' ? value.name.trim() : '';
    if (nameValue) return nameValue;
  }

  return String(value);
}

function firstStringValue(value: unknown): string {
  return extractInventoryScalarValue(value);
}

function formatDurationMinutes(value: unknown): string {
  if (value == null || value === '') return '';

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  const minuteValue = numericValue / 60;
  return Number.isInteger(minuteValue) ? String(minuteValue) : String(minuteValue);
}

export function inventoryFieldUsesSingleSelectUi(fieldName: string): boolean {
  return SINGLE_VALUE_MULTIPLE_SELECT_FIELDS.has(fieldName);
}

export function inventoryFieldUsesMinuteDuration(fieldName: string): boolean {
  return MINUTE_DURATION_FIELDS.has(fieldName);
}

function sortFields(fields: InventoryFieldMetadata[]): InventoryFieldMetadata[] {
  return [...fields].sort((left, right) => {
    const leftIndex = PRIORITY_FIELD_ORDER.indexOf(left.name);
    const rightIndex = PRIORITY_FIELD_ORDER.indexOf(right.name);

    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.name.localeCompare(right.name);
  });
}

function normalizeField(field: AirtableMetadataField): InventoryFieldMetadata {
  return {
    id: field.id,
    name: field.name,
    type: field.type,
    editable: EDITABLE_TYPES.has(field.type),
    choices: dedupeOptions((field.options?.choices ?? []).map((choice) => choice.name)),
  };
}

async function fetchInventoryTableMetadata(): Promise<InventoryFieldMetadata[]> {
  const apiKey = requireEnv('VITE_AIRTABLE_API_KEY');
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${TARGET_BASE_ID}/tables`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load inventory metadata (${response.status}).`);
  }

  const data = await response.json() as AirtableMetadataResponse;
  const table = data.tables?.find((entry) => entry.id === TARGET_TABLE_ID);
  if (!table) {
    throw new Error('Unable to locate SB Inventory metadata.');
  }

  return sortFields(table.fields.map(normalizeField));
}

export async function loadInventoryFieldMetadata(): Promise<InventoryFieldMetadata[]> {
  return fetchInventoryTableMetadata();
}

export function getInventoryEditableFields(fields: InventoryFieldMetadata[]): InventoryFieldMetadata[] {
  return fields.filter((field) => field.editable);
}

export function inventoryFieldSupportsTextInput(field: InventoryFieldMetadata): boolean {
  return TEXT_TYPES.has(field.type);
}

export function inventoryFieldSupportsTextarea(field: InventoryFieldMetadata): boolean {
  return TEXTAREA_TYPES.has(field.type);
}

export function inventoryFieldSupportsNumericInput(field: InventoryFieldMetadata): boolean {
  return NUMERIC_TYPES.has(field.type);
}

export function buildInventoryDraftValues(
  record: AirtableRecord | null,
  fields: InventoryFieldMetadata[],
): Record<string, InventoryDraftValue> {
  if (!record) return {};

  return getInventoryEditableFields(fields).reduce<Record<string, InventoryDraftValue>>((acc, field) => {
    const rawValue = record.fields[field.name];

    if (field.type === 'checkbox') {
      acc[field.name] = Boolean(rawValue);
      return acc;
    }

    if (field.type === 'multipleSelects') {
      if (inventoryFieldUsesSingleSelectUi(field.name)) {
        acc[field.name] = firstStringValue(rawValue);
        return acc;
      }

      acc[field.name] = Array.isArray(rawValue)
        ? rawValue.filter((value): value is string => typeof value === 'string')
        : [];
      return acc;
    }

    if (field.type === 'duration' && inventoryFieldUsesMinuteDuration(field.name)) {
      acc[field.name] = formatDurationMinutes(rawValue);
      return acc;
    }

    acc[field.name] = extractInventoryScalarValue(rawValue);
    return acc;
  }, {});
}

export function inventoryDraftValuesEqual(left: InventoryDraftValue | undefined, right: InventoryDraftValue | undefined): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    const leftValues = Array.isArray(left) ? [...left].sort() : [];
    const rightValues = Array.isArray(right) ? [...right].sort() : [];
    return JSON.stringify(leftValues) === JSON.stringify(rightValues);
  }

  return left === right;
}

export function displayInventoryValue(value: unknown): string {
  if (value == null || value === '') return 'N/A';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    const scalarValue = extractInventoryScalarValue(value);
    return scalarValue || JSON.stringify(value);
  }
  return String(value);
}

export async function loadInventoryDirectory(): Promise<InventoryDirectoryData> {
  const [records, fields] = await Promise.all([
    airtableService.getRecordsFromReference(TARGET_TABLE_REFERENCE, TARGET_TABLE_NAME),
    loadInventoryFieldMetadata(),
  ]);

  return { records, fields };
}

export async function loadInventoryRecord(recordId: string): Promise<AirtableRecord> {
  const records = await airtableService.getRecordsFromReference(TARGET_TABLE_REFERENCE, TARGET_TABLE_NAME);
  const matchingRecord = records.find((record) => record.id === recordId);

  if (!matchingRecord) {
    throw new Error(`Unable to locate SB Inventory record ${recordId}.`);
  }

  return matchingRecord;
}

export async function saveInventoryRecord(
  recordId: string,
  fieldNames: string[],
  draftValues: Record<string, InventoryDraftValue>,
  fields: InventoryFieldMetadata[],
): Promise<AirtableRecord> {
  const metadataByName = new Map(fields.map((field) => [field.name, field]));
  const payload = fieldNames.reduce<Record<string, unknown>>((acc, fieldName) => {
    const field = metadataByName.get(fieldName);
    if (!field || !field.editable) return acc;

    const draftValue = draftValues[fieldName];

    if (field.type === 'checkbox') {
      acc[fieldName] = Boolean(draftValue);
      return acc;
    }

    if (field.type === 'multipleSelects') {
      if (inventoryFieldUsesSingleSelectUi(field.name)) {
        const normalizedValue = typeof draftValue === 'string' ? draftValue.trim() : '';
        acc[fieldName] = normalizedValue === '' ? [] : [normalizedValue];
        return acc;
      }

      acc[fieldName] = Array.isArray(draftValue) ? draftValue.filter(Boolean) : [];
      return acc;
    }

    if (field.type === 'duration' && inventoryFieldUsesMinuteDuration(field.name)) {
      const normalizedValue = typeof draftValue === 'string' ? draftValue.trim() : '';
      acc[fieldName] = normalizedValue === '' ? null : Number(normalizedValue) * 60;
      return acc;
    }

    if (inventoryFieldSupportsNumericInput(field)) {
      const normalizedValue = typeof draftValue === 'string' ? draftValue.trim() : '';
      acc[fieldName] = normalizedValue === '' ? null : Number(normalizedValue);
      return acc;
    }

    const normalizedValue = typeof draftValue === 'string' ? draftValue.trim() : '';
    acc[fieldName] = normalizedValue === '' ? null : normalizedValue;
    return acc;
  }, {});

  return airtableService.updateRecordFromReference(
    TARGET_TABLE_REFERENCE,
    TARGET_TABLE_ID,
    recordId,
    payload,
    { typecast: true },
  );
}