import {
  createConfiguredRecord,
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createTestingFormDefaults, type TestingFormOptionFieldName, type TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { extractInventoryScalarValue } from '@/services/inventoryDirectory';
import type { AirtableRecord } from '@/types/airtable';
import {
  filterWorkflowAttachmentsByStage,
  mergeWorkflowImageMetadata,
  parseWorkflowImageMetadata,
  serializeWorkflowImageMetadata,
  type WorkflowImageMetadataRecord,
} from '@/services/workflowImageMetadata';

const IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const WORKFLOW_IMAGE_METADATA_FIELD_NAME = 'Workflow Image Metadata JSON';
const WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME = 'Images';

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

export type TestingFormRecordSource = 'inventory-directory' | 'used-gear-workflow';

export interface TestingFormCustomerReference {
  cosmeticNotes: string;
  functionalNotes: string;
  inclusionNotes: string;
  submittedPhotosNotes: string;
}

export interface TestingFormContextAttachment {
  id?: string;
  url?: string;
  filename: string;
}

export interface TestingFormStageContext {
  existingAttachments: TestingFormContextAttachment[];
  imageMetadata: WorkflowImageMetadataRecord[];
}

export interface TestingFormLoadResult {
  source: TestingFormRecordSource;
  values: TestingFormValues;
  customerReference: TestingFormCustomerReference;
  stageContext: TestingFormStageContext;
}

export interface TestingFormSubmitResult {
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

function isUnknownFieldNameError(error: unknown, fieldName: string): boolean {
  return error instanceof Error && error.message.includes(`Unknown field name: "${fieldName}"`);
}

function omitWorkflowImageMetadataField(fields: Record<string, unknown>): Record<string, unknown> {
  const nextFields = { ...fields };
  delete nextFields[WORKFLOW_IMAGE_METADATA_FIELD_NAME];
  return nextFields;
}

async function updateRecordWithWorkflowImageMetadataFallback(
  recordSource: TestingFormRecordSource,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  try {
    return await updateConfiguredRecord(recordSource, recordId, fields, { typecast: true });
  } catch (error) {
    if (WORKFLOW_IMAGE_METADATA_FIELD_NAME in fields && isUnknownFieldNameError(error, WORKFLOW_IMAGE_METADATA_FIELD_NAME)) {
      return updateConfiguredRecord(recordSource, recordId, omitWorkflowImageMetadataField(fields), { typecast: true });
    }

    throw error;
  }
}

async function createRecordWithWorkflowImageMetadataFallback(
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  try {
    return await createConfiguredRecord('inventory-directory', fields, { typecast: true });
  } catch (error) {
    if (WORKFLOW_IMAGE_METADATA_FIELD_NAME in fields && isUnknownFieldNameError(error, WORKFLOW_IMAGE_METADATA_FIELD_NAME)) {
      return createConfiguredRecord('inventory-directory', omitWorkflowImageMetadataField(fields), { typecast: true });
    }

    throw error;
  }
}

async function uploadTestingImages(recordId: string, files: File[]): Promise<void> {
  for (const file of files) {
    await uploadConfiguredAttachment('inventory-directory', recordId, IMAGE_ATTACHMENT_FIELD_ID, file);
  }
}

async function syncWorkflowImageMetadataForRecord(params: {
  recordSource: TestingFormRecordSource;
  recordId: string;
  existingMetadata: WorkflowImageMetadataRecord[];
}): Promise<void> {
  const latestRecord = await getConfiguredRecord(params.recordSource, params.recordId);
  const latestAttachments = Array.isArray(latestRecord.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME])
    ? latestRecord.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME] as Array<Record<string, unknown>>
    : [];
  const mergedMetadata = mergeWorkflowImageMetadata({
    attachments: latestAttachments,
    existingMetadata: params.existingMetadata,
    sourceStage: 'testing',
    nowIso: new Date().toISOString(),
  });

  try {
    await updateConfiguredRecord(
      params.recordSource,
      params.recordId,
      {
        [WORKFLOW_IMAGE_METADATA_FIELD_NAME]: serializeWorkflowImageMetadata(mergedMetadata),
      },
      { typecast: true },
    );
  } catch (error) {
    if (isUnknownFieldNameError(error, WORKFLOW_IMAGE_METADATA_FIELD_NAME)) {
      return;
    }

    throw error;
  }
}

async function loadConfiguredTestingRecord(recordId: string): Promise<{ source: TestingFormRecordSource; record: AirtableRecord }> {
  try {
    const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
    return { source: 'used-gear-workflow', record: workflowRecord };
  } catch {
    const inventoryRecord = await getConfiguredRecord('inventory-directory', recordId);
    return { source: 'inventory-directory', record: inventoryRecord };
  }
}

function extractAttachments(value: unknown): TestingFormContextAttachment[] {
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

function buildStageContext(record: AirtableRecord): TestingFormStageContext {
  const attachments = Array.isArray(record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME])
    ? record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME] as Array<Record<string, unknown>>
    : [];
  const imageMetadata = mergeWorkflowImageMetadata({
    attachments,
    existingMetadata: parseWorkflowImageMetadata(record.fields[WORKFLOW_IMAGE_METADATA_FIELD_NAME]),
    sourceStage: 'testing',
    nowIso: new Date().toISOString(),
  });

  return {
    existingAttachments: filterWorkflowAttachmentsByStage(extractAttachments(record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME]), imageMetadata, 'testing'),
    imageMetadata,
  };
}

function buildCustomerReference(record: AirtableRecord): TestingFormCustomerReference {
  return {
    cosmeticNotes: extractInventoryScalarValue(record.fields['Customer Cosmetic Notes']),
    functionalNotes: extractInventoryScalarValue(record.fields['Customer Functional Notes']),
    inclusionNotes: extractInventoryScalarValue(record.fields['Customer Inclusion Notes']),
    submittedPhotosNotes: extractInventoryScalarValue(record.fields['Customer Submitted Photos Notes']),
  };
}

export async function loadTestingFormValues(recordId: string): Promise<TestingFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredTestingRecord(recordId);
    const defaults = createTestingFormDefaults();

    return {
      source,
      customerReference: buildCustomerReference(record),
      stageContext: buildStageContext(record),
      values: {
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
      },
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
    const fields = await getConfiguredFieldMetadata('inventory-directory');

    return OPTION_FIELD_NAMES.reduce<TestingOptionSet>((acc, fieldName) => {
      const field = fields.find((entry) => entry.name === fieldName);
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

export async function submitTestingForm(
  values: TestingFormValues,
  recordId?: string | null,
  options: { recordSource?: TestingFormRecordSource; imageMetadata?: WorkflowImageMetadataRecord[] } = {},
): Promise<TestingFormSubmitResult> {
  const costValue = trimToUndefined(values.cost);
  const testingTimeMinutes = trimToUndefined(values.testingTimeMinutes);
  const serviceTimeMinutes = trimToUndefined(values.serviceTimeMinutes);
  const recordSource = options.recordSource ?? 'inventory-directory';
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
    [WORKFLOW_IMAGE_METADATA_FIELD_NAME]: options.imageMetadata ? serializeWorkflowImageMetadata(options.imageMetadata) : undefined,
  });

  try {
    if (recordId) {
      const updatedRecord = await updateRecordWithWorkflowImageMetadataFallback(recordSource, recordId, baseFields);

      if (values.imageFiles.length > 0) {
        for (const file of values.imageFiles) {
          await uploadConfiguredAttachment(recordSource, updatedRecord.id, IMAGE_ATTACHMENT_FIELD_ID, file);
        }
      }

      if (options.imageMetadata) {
        await syncWorkflowImageMetadataForRecord({
          recordSource,
          recordId: updatedRecord.id,
          existingMetadata: options.imageMetadata,
        });
      }

      return {
        recordId: updatedRecord.id,
        sku: values.sku,
        action: 'updated',
      };
    }

    const createdRecord = await createRecordWithWorkflowImageMetadataFallback(baseFields);

    if (values.imageFiles.length > 0) {
      await uploadTestingImages(createdRecord.id, values.imageFiles);
    }

    if (options.imageMetadata) {
      await syncWorkflowImageMetadataForRecord({
        recordSource: 'inventory-directory',
        recordId: createdRecord.id,
        existingMetadata: options.imageMetadata,
      });
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
