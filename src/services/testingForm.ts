import airtableService from '@/services/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createTestingFormDefaults, type TestingFormOptionFieldName, type TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { extractInventoryScalarValue, loadInventoryRecord } from '@/services/inventoryDirectory';

const TARGET_BASE_ID = 'appjQj8FQfFZ2ogMz';
const TARGET_TABLE_ID = 'tblirsoRIFPDMHxb0';
const TARGET_TABLE_REFERENCE = `${TARGET_BASE_ID}/${TARGET_TABLE_ID}`;
const IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';

const OPTION_FIELD_NAMES = [
  'Status',
  'Component Type',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
  'Shipping Method',
] as const satisfies readonly TestingFormOptionFieldName[];

type TestingOptionSet = Record<TestingFormOptionFieldName, string[]>;

export interface TestingFormSubmitResult {
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

function dateOrUndefined(value: unknown): string {
  const normalizedValue = extractInventoryScalarValue(value);
  return normalizedValue ? normalizedValue.slice(0, 10) : '';
}

function formatDurationMinutes(value: unknown): string {
  if (value == null || value === '') return '';
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return extractInventoryScalarValue(value);
  return String(numericValue / 60);
}

function arrayOrUndefined(value: string): string[] | undefined {
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

async function uploadTestingImages(recordId: string, files: File[]): Promise<void> {
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
    throw new Error('Unable to find the Testing Airtable table.');
  }

  return table;
}

export async function loadTestingFormValues(recordId: string): Promise<TestingFormValues> {
  try {
    const record = await loadInventoryRecord(recordId);
    const defaults = createTestingFormDefaults();

    return {
      ...defaults,
      sku: extractInventoryScalarValue(record.fields.SKU),
      arrivalDate: dateOrUndefined(record.fields['Arrival Date']),
      acquiredFrom: extractInventoryScalarValue(record.fields['Acquired From']),
      make: extractInventoryScalarValue(record.fields.Make),
      model: extractInventoryScalarValue(record.fields.Model),
      componentType: extractInventoryScalarValue(record.fields['Component Type']),
      cost: extractInventoryScalarValue(record.fields.Cost),
      inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
      serialNumber: extractInventoryScalarValue(record.fields['Serial Number']),
      voltage: extractInventoryScalarValue(record.fields.Voltage),
      audiogonRating: extractInventoryScalarValue(record.fields['Audiogon Rating']),
      cosmeticConditionNotes: extractInventoryScalarValue(record.fields['Cosmetic Condition Notes']),
      originalBox: extractInventoryScalarValue(record.fields['Original Box']),
      manual: extractInventoryScalarValue(record.fields.Manual),
      remote: extractInventoryScalarValue(record.fields.Remote),
      powerCable: extractInventoryScalarValue(record.fields['Power Cable']),
      additionalItems: extractInventoryScalarValue(record.fields['Additional Items']),
      shippingWeight: extractInventoryScalarValue(record.fields['Shipping Weight'] ?? record.fields.Weight),
      shippingDims: extractInventoryScalarValue(record.fields['Shipping Dims']),
      shippingMethod: extractInventoryScalarValue(record.fields['Shipping Method']),
      imageFiles: [],
      testingNotes: extractInventoryScalarValue(record.fields['Testing Notes']),
      testingTimeMinutes: formatDurationMinutes(record.fields['Testing Time']),
      serviceNotes: extractInventoryScalarValue(record.fields['Service Notes']),
      serviceTimeMinutes: formatDurationMinutes(record.fields['Service Time']),
      testingDate: dateOrUndefined(record.fields.Tested),
      status: extractInventoryScalarValue(record.fields.Status),
    };
  } catch (error) {
    logServiceError('testingForm', `Error loading Testing form values for ${recordId}`, error);
    const serviceError = createServiceError({
      service: 'testingForm',
      code: 'TESTING_FORM_LOAD_FAILED',
      userMessage: 'Unable to load the selected inventory record into Testing.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function loadTestingFormOptionSets(): Promise<TestingOptionSet> {
  try {
    const table = await fetchTargetTableMetadata();

    return OPTION_FIELD_NAMES.reduce<TestingOptionSet>((acc, fieldName) => {
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
    logServiceError('testingForm', 'Error loading Testing form option sets', error);
    const serviceError = createServiceError({
      service: 'testingForm',
      code: 'TESTING_FORM_OPTIONS_FAILED',
      userMessage: 'Unable to load the Testing form options from Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function submitTestingForm(values: TestingFormValues, recordId?: string | null): Promise<TestingFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);
  const testingTimeMinutes = trimToUndefined(values.testingTimeMinutes);
  const serviceTimeMinutes = trimToUndefined(values.serviceTimeMinutes);
  const baseFields = compactFields({
    SKU: trimToUndefined(values.sku),
    'Arrival Date': trimToUndefined(values.arrivalDate),
    'Acquired From': trimToUndefined(values.acquiredFrom),
    Make: trimToUndefined(values.make),
    Model: trimToUndefined(values.model),
    'Component Type': arrayOrUndefined(values.componentType),
    Cost: costValue ? Number.parseFloat(costValue) : undefined,
    'Inventory Notes': trimToUndefined(values.inventoryNotes),
    'Serial Number': trimToUndefined(values.serialNumber),
    Voltage: trimToUndefined(values.voltage),
    'Audiogon Rating': trimToUndefined(values.audiogonRating),
    'Cosmetic Condition Notes': trimToUndefined(values.cosmeticConditionNotes),
    'Original Box': arrayOrUndefined(values.originalBox),
    Manual: arrayOrUndefined(values.manual),
    Remote: arrayOrUndefined(values.remote),
    'Power Cable': arrayOrUndefined(values.powerCable),
    'Additional Items': trimToUndefined(values.additionalItems),
    'Shipping Weight': trimToUndefined(values.shippingWeight),
    'Shipping Dims': trimToUndefined(values.shippingDims),
    'Shipping Method': arrayOrUndefined(values.shippingMethod),
    'Testing Notes': trimToUndefined(values.testingNotes),
    'Testing Time': testingTimeMinutes ? Number.parseFloat(testingTimeMinutes) * 60 : undefined,
    'Service Notes': trimToUndefined(values.serviceNotes),
    'Service Time': serviceTimeMinutes ? Number.parseFloat(serviceTimeMinutes) * 60 : undefined,
    Tested: trimToUndefined(values.testingDate),
    Status: trimToUndefined(values.status),
  });

  try {
    if (recordId) {
      const updatedRecord = await airtableService.updateRecordFromReference(
        TARGET_TABLE_REFERENCE,
        TARGET_TABLE_ID,
        recordId,
        baseFields,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        await uploadTestingImages(updatedRecord.id, values.imageFiles);
      }

      return {
        recordId: updatedRecord.id,
        sku: values.sku,
        action: 'updated',
      };
    }

    const createdRecord = await airtableService.createRecordFromReference(
      TARGET_TABLE_REFERENCE,
      TARGET_TABLE_ID,
      baseFields,
      { typecast: true },
    );

    if (values.imageFiles.length > 0) {
      await uploadTestingImages(createdRecord.id, values.imageFiles);
    }

    return {
      recordId: createdRecord.id,
      sku: values.sku,
      action: 'created',
    };
  } catch (error) {
    logServiceError('testingForm', `Error ${recordId ? 'updating' : 'creating'} Testing form submission`, error);
    const serviceError = createServiceError({
      service: 'testingForm',
      code: recordId ? 'TESTING_FORM_UPDATE_FAILED' : 'TESTING_FORM_SUBMIT_FAILED',
      userMessage: recordId ? 'Unable to update the Testing fields for this inventory record.' : 'Unable to submit the Testing form to Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}
