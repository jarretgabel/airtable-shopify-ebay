import {
  createConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createPhotosFormDefaults, type PhotosFormOptionFieldName, type PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';
import { extractInventoryScalarValue, loadInventoryRecord } from '@/services/inventoryDirectory';

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

async function uploadImages(recordId: string, fieldId: string, files: File[]): Promise<void> {
  for (const file of files) {
    await uploadConfiguredAttachment('inventory-directory', recordId, fieldId, file);
  }
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
    const fields = await getConfiguredFieldMetadata('inventory-directory');

    return OPTION_FIELD_NAMES.reduce<PhotosOptionSet>((acc, fieldName) => {
      const field = fields.find((entry) => entry.name === fieldName);
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
      const updatedRecord = await updateConfiguredRecord(
        'inventory-directory',
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
      const createdRecord = await createConfiguredRecord(
        'inventory-directory',
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