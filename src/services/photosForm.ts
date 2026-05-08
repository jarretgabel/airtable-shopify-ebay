import {
  createConfiguredRecord,
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createPhotosFormDefaults, type PhotosFormOptionFieldName, type PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';
import { extractInventoryScalarValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';

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

export type PhotosFormRecordSource = 'inventory-directory' | 'used-gear-workflow';

export interface PhotosFormCustomerReference {
  cosmeticNotes: string;
  functionalNotes: string;
  inclusionNotes: string;
  submittedPhotosNotes: string;
}

export interface PhotosFormContextAttachment {
  id?: string;
  url?: string;
  filename: string;
}

export interface PhotosFormStageContext {
  inventoryNotes: string;
  testingNotes: string;
  existingAttachments: PhotosFormContextAttachment[];
}

export interface PhotosFormLoadResult {
  source: PhotosFormRecordSource;
  values: PhotosFormValues;
  customerReference: PhotosFormCustomerReference;
  stageContext: PhotosFormStageContext;
}

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

async function loadConfiguredPhotosRecord(recordId: string): Promise<{ source: PhotosFormRecordSource; record: AirtableRecord }> {
  try {
    const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
    return { source: 'used-gear-workflow', record: workflowRecord };
  } catch {
    const inventoryRecord = await getConfiguredRecord('inventory-directory', recordId);
    return { source: 'inventory-directory', record: inventoryRecord };
  }
}

function extractAttachments(value: unknown): PhotosFormContextAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const attachment = entry as { id?: unknown; url?: unknown; filename?: unknown; name?: unknown };
    const filename = typeof attachment.filename === 'string'
      ? attachment.filename
      : typeof attachment.name === 'string'
        ? attachment.name
        : '';

    if (!filename) {
      return [];
    }

    return [{
      id: typeof attachment.id === 'string' ? attachment.id : undefined,
      url: typeof attachment.url === 'string' ? attachment.url : undefined,
      filename,
    }];
  });
}

function buildCustomerReference(record: AirtableRecord): PhotosFormCustomerReference {
  return {
    cosmeticNotes: extractInventoryScalarValue(record.fields['Customer Cosmetic Notes']),
    functionalNotes: extractInventoryScalarValue(record.fields['Customer Functional Notes']),
    inclusionNotes: extractInventoryScalarValue(record.fields['Customer Inclusion Notes']),
    submittedPhotosNotes: extractInventoryScalarValue(record.fields['Customer Submitted Photos Notes']),
  };
}

function buildStageContext(record: AirtableRecord): PhotosFormStageContext {
  return {
    inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
    testingNotes: extractInventoryScalarValue(record.fields['Testing Notes']),
    existingAttachments: extractAttachments(record.fields['Images (Eduardo)']),
  };
}

export async function loadPhotosFormValues(recordId: string): Promise<PhotosFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredPhotosRecord(recordId);
    const defaults = createPhotosFormDefaults();

    return {
      source,
      customerReference: buildCustomerReference(record),
      stageContext: buildStageContext(record),
      values: {
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
      },
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

export async function submitPhotosForm(
  values: PhotosFormValues,
  recordId?: string | null,
  options: { recordSource?: PhotosFormRecordSource } = {},
): Promise<PhotosFormSubmitResult> {
  const skuValue = values.sku.trim();
  const statusValue = trimToUndefined(values.status) ?? DEFAULT_STATUS;
  const recordSource = options.recordSource ?? 'inventory-directory';

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
        recordSource,
        recordId,
        baseFields,
        { typecast: true },
      );

      if (values.imageFiles.length > 0) {
        for (const file of values.imageFiles) {
          await uploadConfiguredAttachment(recordSource, updatedRecord.id, PRIMARY_IMAGE_ATTACHMENT_FIELD_ID, file);
        }
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