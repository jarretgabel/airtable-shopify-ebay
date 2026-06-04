import type { InventoryDirectoryData, InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import { getConfiguredFieldMetadata, getConfiguredRecord, getConfiguredRecords, updateConfiguredRecord, type AirtableMetadataField } from '@/services/app-api/airtable';
import { enrichUsedGearWorkflowRecord } from '@/services/usedGearWorkflow';
import type { AirtableRecord } from '@/types/airtable';
import { displayReadableValue, extractReadableValue } from '@/utils/valueDisplay';

const INVENTORY_DIRECTORY_LIST_FIELD_NAMES = [
  'SKU',
  'Make',
  'Model',
  'Item Title',
  'Component Type',
  'Status',
  'Workflow Status',
  'Arrival Date',
] as const;

const INVENTORY_DIRECTORY_SKU_FIELDS = ['SKU'] as const;
const INVENTORY_DIRECTORY_MAKE_FIELDS = ['Make'] as const;
const INVENTORY_DIRECTORY_MODEL_FIELDS = ['Model'] as const;
const INVENTORY_DIRECTORY_TITLE_FIELDS = ['Item Title'] as const;
const INVENTORY_DIRECTORY_STATUS_FIELDS = ['Workflow Status', 'Status'] as const;

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
  'Testing Cosmetic Notes',
  'Photography Cosmetic Notes',
  'Internal Cosmetic Notes',
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

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function extractInventoryScalarValue(value: unknown): string {
  return extractReadableValue(value);
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

export async function loadInventoryFieldMetadata(): Promise<InventoryFieldMetadata[]> {
  const fields = await getConfiguredFieldMetadata('inventory-directory');
  return sortFields(fields.map(normalizeField));
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
  return displayReadableValue(value, 'N/A');
}

function getFirstInventoryDirectoryValue(
  fields: Record<string, unknown>,
  fieldNames: readonly string[],
): string {
  for (const fieldName of fieldNames) {
    const value = extractInventoryScalarValue(fields[fieldName]);
    if (value) {
      return value;
    }
  }

  return '';
}

export function getInventoryDirectorySku(fields: Record<string, unknown>): string {
  return getFirstInventoryDirectoryValue(fields, INVENTORY_DIRECTORY_SKU_FIELDS);
}

export function getInventoryDirectoryMake(fields: Record<string, unknown>): string {
  return getFirstInventoryDirectoryValue(fields, INVENTORY_DIRECTORY_MAKE_FIELDS);
}

export function getInventoryDirectoryModel(fields: Record<string, unknown>): string {
  return getFirstInventoryDirectoryValue(fields, INVENTORY_DIRECTORY_MODEL_FIELDS);
}

export function getInventoryDirectoryTitle(fields: Record<string, unknown>): string {
  return getFirstInventoryDirectoryValue(fields, INVENTORY_DIRECTORY_TITLE_FIELDS);
}

export function getInventoryDirectoryStatus(fields: Record<string, unknown>): string {
  return getFirstInventoryDirectoryValue(fields, INVENTORY_DIRECTORY_STATUS_FIELDS);
}

export function getInventoryDirectoryItemLabel(fields: Record<string, unknown>): string {
  const make = getInventoryDirectoryMake(fields);
  const model = getInventoryDirectoryModel(fields);

  if (make && model) {
    return `${make} · ${model}`;
  }

  if (make) {
    return make;
  }

  if (model) {
    return model;
  }

  return getInventoryDirectoryTitle(fields);
}

export async function loadInventoryDirectory(): Promise<InventoryDirectoryData> {
  const records = await getConfiguredRecords('inventory-directory', {
    fields: [...INVENTORY_DIRECTORY_LIST_FIELD_NAMES],
  });

  return { records: records.map(enrichUsedGearWorkflowRecord), fields: [] };
}

export async function loadInventoryRecord(recordId: string): Promise<AirtableRecord> {
  const record = await getConfiguredRecord('inventory-directory', recordId);
  return enrichUsedGearWorkflowRecord(record);
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

  const record = await updateConfiguredRecord(
    'inventory-directory',
    recordId,
    payload,
    { typecast: true },
  );

  return enrichUsedGearWorkflowRecord(record);
}