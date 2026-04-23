import airtableService from '@/services/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createPhotosFormDefaults, type PhotosFormOptionFieldName, type PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';
import { extractInventoryScalarValue, loadInventoryRecord } from '@/services/inventoryDirectory';

const TARGET_BASE_ID = 'appjQj8FQfFZ2ogMz';
const TARGET_TABLE_ID = 'tblirsoRIFPDMHxb0';
const TARGET_TABLE_REFERENCE = `${TARGET_BASE_ID}/${TARGET_TABLE_ID}`;
const PRIMARY_IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const DEFAULT_STATUS = "Photo'd";

const OPTION_FIELD_NAMES = [
  'Status',
  'Component Type',
  'Audiogon Rating',
  'Original Box',
  'Manual',
  'Remote',
  'Power Cable',
] as const satisfies readonly PhotosFormOptionFieldName[];

type PhotosOptionSet = Record<PhotosFormOptionFieldName, string[]>;

export interface PhotosFormSubmitResult {
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

async function uploadImages(recordId: string, fieldId: string, files: File[]): Promise<void> {
  const apiKey = requireAirtableApiKey();

  for (const file of files) {
    const base64File = await fileToBase64(file);
    const response = await fetch(`https://content.airtable.com/v0/${TARGET_BASE_ID}/${recordId}/${fieldId}/uploadAttachment`, {
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
    throw new Error('Unable to find the Photos Airtable table.');
  }

  return table;
}

export async function loadPhotosFormValues(recordId: string): Promise<PhotosFormValues> {
  try {
    const record = await loadInventoryRecord(recordId);
    const defaults = createPhotosFormDefaults();

    return {
      ...defaults,
      sku: extractInventoryScalarValue(record.fields.SKU),
      make: extractInventoryScalarValue(record.fields.Make),
      model: extractInventoryScalarValue(record.fields.Model),
      componentType: extractInventoryScalarValue(record.fields['Component Type']),
      originalBox: extractInventoryScalarValue(record.fields['Original Box']),
      manual: extractInventoryScalarValue(record.fields.Manual),
      remote: extractInventoryScalarValue(record.fields.Remote),
      powerCable: extractInventoryScalarValue(record.fields['Power Cable']),
      additionalItems: extractInventoryScalarValue(record.fields['Additional Items']),
      audiogonRating: extractInventoryScalarValue(record.fields['Audiogon Rating']),
      cosmeticConditionNotes: extractInventoryScalarValue(record.fields['Cosmetic Condition Notes']),
      imageFiles: [],
      photoDate: dateOrFallback(record.fields["Photo'd"], defaults.photoDate),
      status: extractInventoryScalarValue(record.fields.Status) || defaults.status,
    };
  } catch (error) {
    logServiceError('photosForm', `Error loading Photos form values for ${recordId}`, error);
    const serviceError = createServiceError({
      service: 'photosForm',
      code: 'PHOTOS_FORM_LOAD_FAILED',
      userMessage: 'Unable to load the selected inventory record into Photos.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function loadPhotosFormOptionSets(): Promise<PhotosOptionSet> {
  try {
    const table = await fetchTargetTableMetadata();

    return OPTION_FIELD_NAMES.reduce<PhotosOptionSet>((acc, fieldName) => {
      const field = table.fields?.find((entry) => entry.name === fieldName);
      acc[fieldName] = dedupeOptions((field?.options?.choices ?? []).map((choice) => choice.name));
      return acc;
    }, {
      Status: [],
      'Component Type': [],
      'Audiogon Rating': [],
      'Original Box': [],
      Manual: [],
      Remote: [],
      'Power Cable': [],
    });
  } catch (error) {
    logServiceError('photosForm', 'Error loading Photos form option sets', error);
    const serviceError = createServiceError({
      service: 'photosForm',
      code: 'PHOTOS_FORM_OPTIONS_FAILED',
      userMessage: 'Unable to load the Photos form options from Airtable.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}

export async function submitPhotosForm(values: PhotosFormValues, recordId?: string | null): Promise<PhotosFormSubmitResult> {
  const skuValue = values.sku.trim();
  const statusValue = trimToUndefined(values.status) ?? DEFAULT_STATUS;

  const baseFields = compactFields({
    SKU: skuValue,
    Make: trimToUndefined(values.make),
    Model: trimToUndefined(values.model),
    'Component Type': arrayOrUndefined(values.componentType),
    'Original Box': arrayOrUndefined(values.originalBox),
    Manual: arrayOrUndefined(values.manual),
    Remote: arrayOrUndefined(values.remote),
    'Power Cable': arrayOrUndefined(values.powerCable),
    'Additional Items': trimToUndefined(values.additionalItems),
    'Audiogon Rating': arrayOrUndefined(values.audiogonRating),
    'Cosmetic Condition Notes': trimToUndefined(values.cosmeticConditionNotes),
    "Photo'd": trimToUndefined(values.photoDate),
    Status: statusValue,
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
        await uploadImages(updatedRecord.id, PRIMARY_IMAGE_ATTACHMENT_FIELD_ID, values.imageFiles);
      }

      return {
        recordId: updatedRecord.id,
        sku: skuValue,
        action: 'updated',
      };
    } catch (error) {
      logServiceError('photosForm', `Error updating Photos form submission ${recordId}`, error);
      const serviceError = createServiceError({
        service: 'photosForm',
        code: 'PHOTOS_FORM_UPDATE_FAILED',
        userMessage: 'Unable to update the Photos fields for this inventory record.',
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
        await uploadImages(createdRecord.id, PRIMARY_IMAGE_ATTACHMENT_FIELD_ID, values.imageFiles);
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

  logServiceError('photosForm', 'Error creating Photos form submission', lastError);
  const serviceError = createServiceError({
    service: 'photosForm',
    code: 'PHOTOS_FORM_SUBMIT_FAILED',
    userMessage: 'Unable to submit the Photos form to Airtable.',
    retryable: true,
    cause: lastError,
  });
  const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
  typedError.serviceError = serviceError;
  throw typedError;
}