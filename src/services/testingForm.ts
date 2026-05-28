import {
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import type { AirtableAttachmentUploadOptions } from '@/services/app-api/airtable';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createTestingFormDefaults, type TestingFormOptionFieldName, type TestingFormValues } from '@/components/tabs/testing/testingFormSchema';
import { resolveCurrentActorName } from '@/services/currentUserAudit';
import { extractInventoryScalarValue } from '@/services/inventoryDirectory';
import type { FormImageUploadAsset } from '@/services/formImageUploads';
import {
  getUsedGearWorkflowStatus,
  isAcceptedUsedGearWorkflowStatus,
  USED_GEAR_WORKFLOW_STATUS_FIELD,
} from '@/services/usedGearWorkflow';
import type { AirtableRecord } from '@/types/airtable';
import {
  filterWorkflowAttachmentsByStage,
  filterWorkflowImageMetadataByStage,
  mergeWorkflowImageMetadata,
  parseWorkflowImageMetadata,
  replaceWorkflowImageMetadataStage,
  serializeWorkflowImageMetadata,
  type WorkflowImageMetadataRecord,
} from '@/services/workflowImageMetadata';

const INVENTORY_IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const WORKFLOW_IMAGE_ATTACHMENT_FIELD_ID = 'fld1zIzmZEciQECah';
const WORKFLOW_IMAGE_METADATA_FIELD_NAME = 'Workflow Image Metadata JSON';
const WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME = 'Images';
const DEFAULT_STATUS = 'Tested';
const TESTING_COSMETIC_NOTES_FIELD_NAME = 'Testing Cosmetic Notes';
const LEGACY_TESTING_COSMETIC_NOTES_FIELD_NAME = 'Cosmetic Condition Notes';
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
  referenceAttachments: TestingFormContextAttachment[];
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

export interface TestingFormImageUploadProgress {
  total: number;
  completed: number;
  currentFilename: string;
  phase: 'uploading' | 'finalizing';
}

function getImageAttachmentFieldId(recordSource: TestingFormRecordSource): string {
  return recordSource === 'used-gear-workflow'
    ? WORKFLOW_IMAGE_ATTACHMENT_FIELD_ID
    : INVENTORY_IMAGE_ATTACHMENT_FIELD_ID;
}

function buildContextAttachmentsFromStageMetadata(
  records: WorkflowImageMetadataRecord[],
  stage: 'testing' | 'photos',
): TestingFormContextAttachment[] {
  return filterWorkflowImageMetadataByStage(records, stage).map((record) => ({
    id: record.attachmentId,
    url: record.url,
    filename: record.filename,
  }));
}

function appendArchivedStageMetadata(
  records: WorkflowImageMetadataRecord[],
  archivedFiles: Array<{ id: string; url: string; filename: string }>,
): WorkflowImageMetadataRecord[] {
  const currentStageRecords = filterWorkflowImageMetadataByStage(records, 'testing');
  const existingUrls = new Set(currentStageRecords.map((record) => record.url.trim().toLowerCase()));
  const nowIso = new Date().toISOString();
  const additions = archivedFiles
    .filter((file) => {
      const key = file.url.trim().toLowerCase();
      return Boolean(key) && !existingUrls.has(key);
    })
    .map((file, index) => ({
      attachmentId: file.id,
      url: file.url,
      filename: file.filename,
      alt: '',
      sortOrder: currentStageRecords.length + index + 1,
      sourceStage: 'testing',
      includedInListing: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    } satisfies WorkflowImageMetadataRecord));

  return replaceWorkflowImageMetadataStage(records, 'testing', [...currentStageRecords, ...additions]);
}

interface TestingFormSubmitOptions {
  recordSource?: TestingFormRecordSource;
  imageMetadata?: WorkflowImageMetadataRecord[];
  imageUploadAssets?: FormImageUploadAsset[];
  completeWorkflowStage?: boolean;
  onImageUploadProgress?: (progress: TestingFormImageUploadProgress) => void;
}

function buildWorkflowTestingFields(record: AirtableRecord, actorName: string | null, testedAt: string): Record<string, unknown> {
  const signoffFields = compactFields({
    'Testing Signed At': testedAt,
    'Testing Signed By': actorName ?? undefined,
  });
  const currentStatus = getUsedGearWorkflowStatus(record.fields);

  if (currentStatus === 'Testing In Progress') {
    return {
      ...signoffFields,
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: 'Photography In Progress',
    };
  }

  return signoffFields;
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

function assertApprovedTestingWorkflowRecord(record: AirtableRecord): void {
  const workflowStatus = getUsedGearWorkflowStatus(record.fields);

  if (!workflowStatus || !isAcceptedUsedGearWorkflowStatus(workflowStatus)) {
    throw new Error('Testing is available only for workflow items that have already been approved for intake.');
  }
}

async function syncWorkflowImageMetadataForRecord(params: {
  recordSource: TestingFormRecordSource;
  recordId: string;
  existingMetadata: WorkflowImageMetadataRecord[];
  nextMetadata?: WorkflowImageMetadataRecord[];
}): Promise<void> {
  const mergedMetadata = params.nextMetadata ?? await (async () => {
    const latestRecord = await getConfiguredRecord(params.recordSource, params.recordId);
    const latestAttachments = Array.isArray(latestRecord.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME])
      ? latestRecord.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME] as Array<Record<string, unknown>>
      : [];
    return mergeWorkflowImageMetadata({
      attachments: latestAttachments,
      existingMetadata: params.existingMetadata,
      sourceStage: 'testing',
      nowIso: new Date().toISOString(),
    });
  })();

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
  const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
  assertApprovedTestingWorkflowRecord(workflowRecord);
  return { source: 'used-gear-workflow', record: workflowRecord };
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
  const allAttachments = extractAttachments(record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME]);
  const parsedImageMetadata = parseWorkflowImageMetadata(record.fields[WORKFLOW_IMAGE_METADATA_FIELD_NAME]);
  const imageMetadata = parsedImageMetadata.length > 0 && attachments.length > 0
    ? mergeWorkflowImageMetadata({
        attachments,
        existingMetadata: parsedImageMetadata,
        sourceStage: 'testing',
        nowIso: new Date().toISOString(),
      })
    : parsedImageMetadata;
  const existingAttachments = filterWorkflowAttachmentsByStage(
    allAttachments,
    imageMetadata,
    'testing',
  );

  return {
    existingAttachments: existingAttachments.length > 0 ? existingAttachments : buildContextAttachmentsFromStageMetadata(imageMetadata, 'testing'),
    referenceAttachments: parsedImageMetadata.length === 0 ? allAttachments : [],
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
        cosmeticConditionNotes: extractInventoryScalarValue(record.fields[TESTING_COSMETIC_NOTES_FIELD_NAME] ?? record.fields[LEGACY_TESTING_COSMETIC_NOTES_FIELD_NAME]),
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
  options: TestingFormSubmitOptions = {},
): Promise<TestingFormSubmitResult> {
  const recordSource = options.recordSource ?? 'inventory-directory';
  const actorName = resolveCurrentActorName();
  const testedAt = new Date().toISOString();
  const statusValue = DEFAULT_STATUS;

  try {
    if (!recordId || recordSource !== 'used-gear-workflow') {
      throw new Error('Testing forms require an approved workflow item and cannot be opened as a blank or inventory-only form.');
    }

    const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
    assertApprovedTestingWorkflowRecord(workflowRecord);
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
      [TESTING_COSMETIC_NOTES_FIELD_NAME]: trimToUndefined(values.cosmeticConditionNotes),
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
      Status: statusValue,
      [WORKFLOW_IMAGE_METADATA_FIELD_NAME]: options.imageMetadata ? serializeWorkflowImageMetadata(options.imageMetadata) : undefined,
      ...(options.completeWorkflowStage ? buildWorkflowTestingFields(workflowRecord, actorName, testedAt) : {}),
    });

    const updatedRecord = await updateRecordWithWorkflowImageMetadataFallback(recordSource, recordId, baseFields);
    let finalImageMetadata = options.imageMetadata ?? [];
    let usedArchiveOnlyWorkflowUpload = false;

    if (values.imageFiles.length > 0) {
      const totalUploads = values.imageFiles.length;
      for (const [index, file] of values.imageFiles.entries()) {
        options.onImageUploadProgress?.({
          total: totalUploads,
          completed: index,
          currentFilename: file.name,
          phase: 'uploading',
        });
        const uploadOptions: AirtableAttachmentUploadOptions | undefined = options.imageUploadAssets?.[index]
          ? {
              driveArchive: {
                sku: values.sku,
                stage: 'testing',
                originalFile: options.imageUploadAssets[index].originalFile,
              },
            }
          : undefined;
        const shouldArchiveOnly = recordSource === 'used-gear-workflow' && Boolean(uploadOptions?.driveArchive);
        const uploadResult = await uploadConfiguredAttachment(
          recordSource,
          updatedRecord.id,
          getImageAttachmentFieldId(recordSource),
          file,
          shouldArchiveOnly
            ? {
                ...uploadOptions,
                archiveOnly: true,
              }
            : uploadOptions,
        );

        if (shouldArchiveOnly && uploadResult.archive?.processed) {
          usedArchiveOnlyWorkflowUpload = true;
          finalImageMetadata = appendArchivedStageMetadata(finalImageMetadata, [uploadResult.archive.processed]);
        }

        options.onImageUploadProgress?.({
          total: totalUploads,
          completed: index + 1,
          currentFilename: file.name,
          phase: 'uploading',
        });
      }
    }

    if (usedArchiveOnlyWorkflowUpload) {
      options.onImageUploadProgress?.({
        total: values.imageFiles.length,
        completed: values.imageFiles.length,
        currentFilename: '',
        phase: 'finalizing',
      });
      await syncWorkflowImageMetadataForRecord({
        recordSource,
        recordId: updatedRecord.id,
        existingMetadata: finalImageMetadata,
        nextMetadata: finalImageMetadata,
      });
    } else if (options.imageMetadata) {
      options.onImageUploadProgress?.({
        total: values.imageFiles.length,
        completed: values.imageFiles.length,
        currentFilename: '',
        phase: 'finalizing',
      });
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
  } catch (error) {
    logServiceError('testingForm', 'Error updating Testing form submission', error);
    const serviceError = createServiceError({
      service: 'testingForm',
      code: 'TESTING_FORM_UPDATE_FAILED',
      userMessage: 'Unable to update the Testing fields for this workflow item.',
      retryable: true,
      cause: error,
    });
    const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
    typedError.serviceError = serviceError;
    throw typedError;
  }
}
