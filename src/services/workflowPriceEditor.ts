import type { InventoryDraftValue, InventoryFieldMetadata } from '@/components/tabs/airtable/inventoryDirectoryTypes';
import { getConfiguredFieldMetadata, getConfiguredRecord, updateConfiguredRecord, type AirtableMetadataField } from '@/services/app-api/airtable';
import {
  buildInventoryDraftValues,
  getInventoryEditableFields,
  inventoryFieldSupportsNumericInput,
  inventoryFieldUsesMinuteDuration,
  inventoryFieldUsesSingleSelectUi,
} from '@/services/inventoryDirectory';
import { enrichUsedGearWorkflowRecord } from '@/services/usedGearWorkflow';
import { PRICE_FIELD_CANDIDATES } from '@/services/usedGearWorkflowListingReadiness';
import type { AirtableRecord } from '@/types/airtable';

const WORKFLOW_PRICE_FIELD_ORDER: string[] = [...PRICE_FIELD_CANDIDATES];
const WORKFLOW_PRICE_FIELD_NAMES = new Set<string>(WORKFLOW_PRICE_FIELD_ORDER);

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

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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

function sortFields(fields: InventoryFieldMetadata[]): InventoryFieldMetadata[] {
  return [...fields].sort((left, right) => {
    const leftIndex = WORKFLOW_PRICE_FIELD_ORDER.indexOf(left.name);
    const rightIndex = WORKFLOW_PRICE_FIELD_ORDER.indexOf(right.name);

    if (leftIndex >= 0 && rightIndex >= 0) return leftIndex - rightIndex;
    if (leftIndex >= 0) return -1;
    if (rightIndex >= 0) return 1;
    return left.name.localeCompare(right.name);
  });
}

export async function loadWorkflowPriceFieldMetadata(): Promise<InventoryFieldMetadata[]> {
  const fields = await getConfiguredFieldMetadata('used-gear-workflow');

  return sortFields(
    fields
      .map(normalizeField)
      .filter((field) => field.editable && WORKFLOW_PRICE_FIELD_NAMES.has(field.name)),
  );
}

export async function loadWorkflowPriceRecord(recordId: string): Promise<AirtableRecord> {
  const record = await getConfiguredRecord('used-gear-workflow', recordId);
  return enrichUsedGearWorkflowRecord(record);
}

export async function saveWorkflowPriceRecord(
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

  const record = await updateConfiguredRecord('used-gear-workflow', recordId, payload, { typecast: true });
  return enrichUsedGearWorkflowRecord(record);
}

export { buildInventoryDraftValues, getInventoryEditableFields };