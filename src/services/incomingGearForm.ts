import airtableService from '@/services/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createIncomingGearFormDefaults, type IncomingGearFormOptionFieldName, type IncomingGearFormValues } from '@/components/tabs/incoming-gear/incomingGearFormSchema';
import { extractInventoryScalarValue, loadInventoryRecord } from '@/services/inventoryDirectory';

const TARGET_BASE_ID = 'appjQj8FQfFZ2ogMz';
const TARGET_TABLE_ID = 'tblirsoRIFPDMHxb0';
const TARGET_TABLE_REFERENCE = `${TARGET_BASE_ID}/${TARGET_TABLE_ID}`;
const IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const DEFAULT_STATUS = 'Needs Initial Processing';

const OPTION_FIELD_NAMES = [
  'Status',
  'Component Type',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Shipping Method',
] as const satisfies readonly IncomingGearFormOptionFieldName[];

type IncomingGearOptionSet = Record<IncomingGearFormOptionFieldName, string[]>;

export interface IncomingGearFormSubmitResult {
  recordId: string;
  sku: string;
  action: 'created' | 'updated';
}

function requireAirtableApiKey(): string {
  const apiKey = import.meta.env.VITE_AIRTABLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing VITE_AIRTABLE_API_KEY.');
  }
  return apiKey;
}

function dedupeOptions(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function trimToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dateOrFallback(value: unknown, fallback: string): string {
  const normalizedValue = extractInventoryScalarValue(value);
  return normalizedValue ? normalizedValue.slice(0, 10) : fallback;
}

function arrayOrUndefined(value: string): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

function singleValueAsArrayOrUndefined(value: string): string[] | undefined {
  const trimmed = trimToUndefined(value);
  return trimmed ? [trimmed] : undefined;
}

function compactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
}

function createTemporarySku(): string {
  const iso = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `INTAKE-${iso}`;
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

async function uploadIncomingGearImages(recordId: string, files: File[]): Promise<void> {
  const apiKey = requireAirtableApiKey();

  for (const file of files) {
    const base64File = await fileToBase64(file);
    const response = await fetch(`https://content.airtable.com/v0/${TARGET_BASE_ID}/${recordId}/${IMAGE_ATTACHMENT_FIELD_ID}/uploadAttachment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        file: base64File,
      }),
    });

    if (!response.ok) {
      throw new Error(`Unable to upload image ${file.name} (${response.status}).`);
    }
  }
}

async function fetchTargetTableMetadata() {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${TARGET_BASE_ID}/tables`, {
    headers: {
      Authorization: `Bearer ${requireAirtableApiKey()}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load Airtable metadata (${response.status}).`);
  }

  const data = (await response.json()) as {
    tables?: Array<{
      id: string;
      fields?: Array<{
        name: string;
        options?: { choices?: Array<{ name: string }> };
      }>;
    }>;
  };

  const table = data.tables?.find((entry) => entry.id === TARGET_TABLE_ID);
  if (!table) {
    throw new Error('Unable to find the Incoming Gear Airtable table.');
  }

  return table;
}

export async function loadIncomingGearFormValues(recordId: string): Promise<IncomingGearFormValues> {
  try {
    const record = await loadInventoryRecord(recordId);
    const defaults = createIncomingGearFormDefaults();

    return {
      ...defaults,
      arrivalDate: dateOrFallback(record.fields['Arrival Date'], defaults.arrivalDate),
      pickUpNumber: extractInventoryScalarValue(record.fields['Pick Up #']),
      acquiredFrom: extractInventoryScalarValue(record.fields['Acquired From']),
      cost: extractInventoryScalarValue(record.fields.Cost),
      sku: extractInventoryScalarValue(record.fields.SKU),
      status: extractInventoryScalarValue(record.fields.Status) || defaults.status,
      make: extractInventoryScalarValue(record.fields.Make),
      model: extractInventoryScalarValue(record.fields.Model),
      componentType: extractInventoryScalarValue(record.fields['Component Type']),
      serialNumber: extractInventoryScalarValue(record.fields['Serial Number']),
      voltage: extractInventoryScalarValue(record.fields.Voltage),
      inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
      imageFiles: [],
      cosmeticConditionNotes: extractInventoryScalarValue(record.fields['Cosmetic Condition Notes']),
      originalBox: extractInventoryScalarValue(record.fields['Original Box']),
      manual: extractInventoryScalarValue(record.fields.Manual),
      remote: extractInventoryScalarValue(record.fields.Remote),
      powerCable: extractInventoryScalarValue(record.fields['Power Cable']),
      additionalItems: extractInventoryScalarValue(record.fields['Additional Items']),
      weight: extractInventoryScalarValue(record.fields.Weight),
      shippingDims: extractInventoryScalarValue(record.fields['Shipping Dims']),
      shippingMethod: extractInventoryScalarValue(record.fields['Shipping Method']),
    };
  } catch (error) {
    logServiceError('incomingGearForm', `Error loading Incoming Gear form values for ${recordId}`, error);
    const serviceError = createServiceError({
      service: 'incomingGearForm',
      code: 'INCOMING_GEAR_LOAD_FAILED',
      userMessage: 'Unable to load the selected inventory record into Incoming Gear.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function loadIncomingGearFormOptionSets(): Promise<IncomingGearOptionSet> {
  try {
    const table = await fetchTargetTableMetadata();

    return OPTION_FIELD_NAMES.reduce<IncomingGearOptionSet>((acc, fieldName) => {
      const field = table.fields?.find((entry) => entry.name === fieldName);
      acc[fieldName] = dedupeOptions((field?.options?.choices ?? []).map((choice) => choice.name));
      return acc;
    }, {
      Status: [],
      'Component Type': [],
      'Original Box': [],
      Manual: [],
      Remote: [],
      'Power Cable': [],
      'Shipping Method': [],
    });
  } catch (error) {
    logServiceError('incomingGearForm', 'Error loading Incoming Gear form option sets', error);
    const serviceError = createServiceError({
      service: 'incomingGearForm',
      code: 'INCOMING_GEAR_OPTIONS_FAILED',
      userMessage: 'Unable to load the Incoming Gear form options from Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function submitIncomingGearForm(values: IncomingGearFormValues, recordId?: string | null): Promise<IncomingGearFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);
  const skuValue = trimToUndefined(values.sku) ?? createTemporarySku();
  const statusValue = trimToUndefined(values.status) ?? DEFAULT_STATUS;

  const baseFields = compactFields({
    'Arrival Date': trimToUndefined(values.arrivalDate),
    'Pick Up #': trimToUndefined(values.pickUpNumber),
    'Acquired From': trimToUndefined(values.acquiredFrom),
    Cost: costValue ? Number.parseFloat(costValue) : undefined,
    SKU: skuValue,
    Status: statusValue,
    Make: trimToUndefined(values.make),
    Model: trimToUndefined(values.model),
    'Component Type': singleValueAsArrayOrUndefined(values.componentType),
    'Serial Number': trimToUndefined(values.serialNumber),
    Voltage: trimToUndefined(values.voltage),
    'Inventory Notes': trimToUndefined(values.inventoryNotes),
    'Cosmetic Condition Notes': trimToUndefined(values.cosmeticConditionNotes),
    'Original Box': arrayOrUndefined(values.originalBox),
    Manual: arrayOrUndefined(values.manual),
    Remote: arrayOrUndefined(values.remote),
    'Power Cable': arrayOrUndefined(values.powerCable),
    'Additional Items': trimToUndefined(values.additionalItems),
    Weight: trimToUndefined(values.weight),
    'Shipping Dims': trimToUndefined(values.shippingDims),
    'Shipping Method': arrayOrUndefined(values.shippingMethod),
  });

  const createCandidates: Array<Record<string, unknown>> = [
    compactFields({ SKU: { text: skuValue }, ...baseFields }),
    compactFields({ SKU: skuValue, ...baseFields }),
    baseFields,
  ];

  if (recordId) {
    try {
      const updatedRecord = await airtableService.updateRecordFromReference(
        TARGET_TABLE_REFERENCE,
        TARGET_TABLE_ID,
        recordId,
        baseFields,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        await uploadIncomingGearImages(updatedRecord.id, values.imageFiles);
      }

      return {
        recordId: updatedRecord.id,
        sku: skuValue,
        action: 'updated',
      };
    } catch (error) {
      logServiceError('incomingGearForm', `Error updating Incoming Gear submission ${recordId}`, error);
      const serviceError = createServiceError({
        service: 'incomingGearForm',
        code: 'INCOMING_GEAR_UPDATE_FAILED',
        userMessage: 'Unable to update the Incoming Gear fields for this inventory record.',
        retryable: true,
        cause: error,
      });
      const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
      typedError.serviceError = serviceError;
      throw typedError;
    }
  }

  let lastError: unknown = null;

  for (const candidate of createCandidates) {
    try {
      const createdRecord = await airtableService.createRecordFromReference(
        TARGET_TABLE_REFERENCE,
        TARGET_TABLE_ID,
        candidate,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        await uploadIncomingGearImages(createdRecord.id, values.imageFiles);
      }

      return {
        recordId: createdRecord.id,
        sku: skuValue,
        action: 'created',
      };
    } catch (error) {
      lastError = error;
    }
  }

  logServiceError('incomingGearForm', 'Error creating Incoming Gear submission', lastError);
  const serviceError = createServiceError({
    service: 'incomingGearForm',
    code: 'INCOMING_GEAR_SUBMIT_FAILED',
    userMessage: 'Unable to submit the Incoming Gear form to Airtable.',
    retryable: true,
    cause: lastError,
  });
  const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
  typedError.serviceError = serviceError;
  throw typedError;
}
