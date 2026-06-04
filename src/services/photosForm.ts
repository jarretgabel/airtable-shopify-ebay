import {
  getConfiguredRecord,
  getConfiguredFieldMetadata,
  updateConfiguredRecord,
  uploadConfiguredAttachment,
} from '@/services/app-api/airtable';
import type { AirtableAttachmentUploadOptions } from '@/services/app-api/airtable';
import { resolveCurrentActorName } from '@/services/currentUserAudit';
import { logServiceError } from '@/services/logger';
import { createServiceError, type ServiceError } from '@/services/serviceErrors';
import { createPhotosFormDefaults, type PhotosFormOptionFieldName, type PhotosFormValues } from '@/components/tabs/photos/photosFormSchema';
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
import { buildUsedGearItemTitle } from '../../aws/src/shared/contracts/usedGearItemTitle';
import { getUsedGearRecordItemTitle } from '@/services/usedGearItemTitle';

const INVENTORY_IMAGE_ATTACHMENT_FIELD_ID = 'fldMXp0EaUHGglU8M';
const WORKFLOW_IMAGE_ATTACHMENT_FIELD_ID = 'fld1zIzmZEciQECah';
const DEFAULT_STATUS = "Photo'd";
const WORKFLOW_IMAGE_METADATA_FIELD_NAME = 'Workflow Image Metadata JSON';
const WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME = 'Images';
const TESTING_COSMETIC_NOTES_FIELD_NAME = 'Testing Cosmetic Notes';
const PHOTOGRAPHY_COSMETIC_NOTES_FIELD_NAME = 'Photography Cosmetic Notes';

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
}

export interface PhotosFormContextAttachment {
  id?: string;
  url?: string;
  filename: string;
}

export interface PhotosFormStageContext {
  inventoryNotes: string;
  testingNotes: string;
  testingCosmeticNotes: string;
  existingAttachments: PhotosFormContextAttachment[];
  intakeReferenceAttachments: PhotosFormContextAttachment[];
  testingReferenceAttachments: PhotosFormContextAttachment[];
  imageMetadata: WorkflowImageMetadataRecord[];
}

export interface PhotosFormLoadResult {
  source: PhotosFormRecordSource;
  itemTitle: string;
  values: PhotosFormValues;
  customerReference: PhotosFormCustomerReference;
  stageContext: PhotosFormStageContext;
}

export interface PhotosFormSubmitResult {
  recordId: string;
  sku: string;
  action: 'created' | 'updated';
}

export interface PhotosFormImageUploadProgress {
  total: number;
  completed: number;
  currentFilename: string;
  phase: 'uploading' | 'finalizing';
}

function getImageAttachmentFieldId(recordSource: PhotosFormRecordSource): string {
  return recordSource === 'used-gear-workflow'
    ? WORKFLOW_IMAGE_ATTACHMENT_FIELD_ID
    : INVENTORY_IMAGE_ATTACHMENT_FIELD_ID;
}

function buildContextAttachmentsFromMetadata(records: WorkflowImageMetadataRecord[]): PhotosFormContextAttachment[] {
  return filterWorkflowImageMetadataByStage(records, 'photos').map((record) => ({
    id: record.attachmentId,
    url: record.url,
    filename: record.filename,
  }));
}

function appendArchivedStageMetadata(
  records: WorkflowImageMetadataRecord[],
  archivedFiles: Array<{ id: string; url: string; filename: string }>,
): WorkflowImageMetadataRecord[] {
  const currentStageRecords = filterWorkflowImageMetadataByStage(records, 'photos');
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
      sourceStage: 'photos',
      includedInListing: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    } satisfies WorkflowImageMetadataRecord));

  return replaceWorkflowImageMetadataStage(records, 'photos', [...currentStageRecords, ...additions]);
}

interface PhotosFormSubmitOptions {
  recordSource?: PhotosFormRecordSource;
  imageMetadata?: WorkflowImageMetadataRecord[];
  imageUploadAssets?: FormImageUploadAsset[];
  completeWorkflowStage?: boolean;
  onImageUploadProgress?: (progress: PhotosFormImageUploadProgress) => void;
}

function buildWorkflowPhotographyFields(record: AirtableRecord, actorName: string | null, photographedAt: string): Record<string, unknown> {
  const signoffFields = compactFields({
    'Photography Signed At': photographedAt,
    'Photography Signed By': actorName ?? undefined,
  });
  const currentStatus = getUsedGearWorkflowStatus(record.fields);

  if (currentStatus === 'Photography In Progress') {
    return {
      ...signoffFields,
      [USED_GEAR_WORKFLOW_STATUS_FIELD]: 'Awaiting Pre-Listing Review',
      'Awaiting Pre-Listing Review At': typeof record.fields['Awaiting Pre-Listing Review At'] === 'string' && record.fields['Awaiting Pre-Listing Review At'].trim().length > 0
        ? record.fields['Awaiting Pre-Listing Review At']
        : photographedAt,
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

function isUnknownFieldNameError(error: unknown, fieldName: string): boolean {
  return error instanceof Error && error.message.includes(`Unknown field name: "${fieldName}"`);
}

function omitWorkflowImageMetadataField(fields: Record<string, unknown>): Record<string, unknown> {
  const nextFields = { ...fields };
  delete nextFields[WORKFLOW_IMAGE_METADATA_FIELD_NAME];
  return nextFields;
}

async function updateRecordWithWorkflowImageMetadataFallback(
  recordSource: PhotosFormRecordSource,
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

function assertApprovedPhotosWorkflowRecord(record: AirtableRecord): void {
  const workflowStatus = getUsedGearWorkflowStatus(record.fields);

  if (!workflowStatus || !isAcceptedUsedGearWorkflowStatus(workflowStatus)) {
    throw new Error('Photos is available only for workflow items that have already been approved for intake.');
  }
}

function assertPhotographyStageReadyForCompletion(record: AirtableRecord): void {
  const workflowStatus = getUsedGearWorkflowStatus(record.fields);

  if (workflowStatus === 'Testing In Progress') {
    throw new Error('Photography can start only after testing is complete.');
  }
}

async function syncWorkflowImageMetadataForRecord(params: {
  recordSource: PhotosFormRecordSource;
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
      sourceStage: 'photos',
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

async function loadConfiguredPhotosRecord(recordId: string): Promise<{ source: PhotosFormRecordSource; record: AirtableRecord }> {
  let workflowRecord: AirtableRecord;

  try {
    workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
  } catch (error) {
    const nextError = new Error('This workflow record could not be found in the current Airtable workflow table. If sample data was reseeded, reopen the item from the workflow queue to use its current record URL.') as Error & { cause?: unknown };
    nextError.cause = error;
    throw nextError;
  }

  assertApprovedPhotosWorkflowRecord(workflowRecord);
  return { source: 'used-gear-workflow', record: workflowRecord };
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

function isAttachmentLinkedToMetadata(
  attachment: PhotosFormContextAttachment,
  metadata: WorkflowImageMetadataRecord[],
): boolean {
  return metadata.some((record) => {
    if (attachment.id && record.attachmentId) {
      return attachment.id === record.attachmentId;
    }

    return Boolean(attachment.url && record.url && attachment.url === record.url);
  });
}

function buildCustomerReference(record: AirtableRecord): PhotosFormCustomerReference {
  return {
    cosmeticNotes: extractInventoryScalarValue(record.fields['Customer Cosmetic Notes']),
    functionalNotes: extractInventoryScalarValue(record.fields['Customer Functional Notes']),
    inclusionNotes: extractInventoryScalarValue(record.fields['Customer Inclusion Notes']),
  };
}

function buildStageContext(record: AirtableRecord): PhotosFormStageContext {
  const attachments = Array.isArray(record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME])
    ? record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME] as Array<Record<string, unknown>>
    : [];
  const allAttachments = extractAttachments(record.fields[WORKFLOW_IMAGE_ATTACHMENT_FIELD_NAME]);
  const parsedImageMetadata = parseWorkflowImageMetadata(record.fields[WORKFLOW_IMAGE_METADATA_FIELD_NAME]);
  const attachmentsForMetadataMerge = parsedImageMetadata.length > 0
    ? allAttachments
      .filter((attachment) => isAttachmentLinkedToMetadata(attachment, parsedImageMetadata))
      .map((attachment) => ({
        id: attachment.id,
        url: attachment.url,
        filename: attachment.filename,
      }))
    : attachments;
  const imageMetadata = parsedImageMetadata.length > 0 && attachments.length > 0
    ? mergeWorkflowImageMetadata({
        attachments: attachmentsForMetadataMerge,
        existingMetadata: parsedImageMetadata,
        sourceStage: 'photos',
        nowIso: new Date().toISOString(),
      })
    : parsedImageMetadata;
  const existingAttachments = imageMetadata.length > 0
    ? filterWorkflowAttachmentsByStage(
      allAttachments,
      imageMetadata,
      'photos',
    )
    : [];
  const intakeReferenceAttachments = filterWorkflowImageMetadataByStage(imageMetadata, 'intake').map((reference) => ({
    id: reference.attachmentId,
    url: reference.url,
    filename: reference.filename,
  }));
  const testingReferenceAttachments = filterWorkflowImageMetadataByStage(imageMetadata, 'testing').map((reference) => ({
    id: reference.attachmentId,
    url: reference.url,
    filename: reference.filename,
  }));

  return {
    inventoryNotes: extractInventoryScalarValue(record.fields['Inventory Notes']),
    testingNotes: extractInventoryScalarValue(record.fields['Testing Notes']),
    testingCosmeticNotes: extractInventoryScalarValue(record.fields[TESTING_COSMETIC_NOTES_FIELD_NAME]),
    existingAttachments: existingAttachments.length > 0 ? existingAttachments : buildContextAttachmentsFromMetadata(imageMetadata),
    intakeReferenceAttachments,
    testingReferenceAttachments,
    imageMetadata,
  };
}

export async function loadPhotosFormValues(recordId: string): Promise<PhotosFormLoadResult> {
  try {
    const { source, record } = await loadConfiguredPhotosRecord(recordId);
    const defaults = createPhotosFormDefaults();

    return {
      source,
      itemTitle: getUsedGearRecordItemTitle(record.fields, record.id),
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
        cosmeticConditionNotes: extractInventoryScalarValue(record.fields[PHOTOGRAPHY_COSMETIC_NOTES_FIELD_NAME]),
        imageFiles: [],
        photoDate: dateOrFallback(record.fields["Photo'd"], defaults.photoDate),
        status: extractInventoryScalarValue(record.fields.Status) || defaults.status,
      },
    };
  } catch (error) {
    logServiceError('photosForm', `Error loading Photos form values for ${recordId}`, error);
    const userMessage = error instanceof Error && error.message.includes('could not be found in the current Airtable workflow table')
      ? error.message
      : 'Unable to load the selected inventory record into Photos.';
    const serviceError = createServiceError({
      service: 'photosForm',
      code: 'PHOTOS_FORM_LOAD_FAILED',
      userMessage,
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
  options: PhotosFormSubmitOptions = {},
): Promise<PhotosFormSubmitResult> {
  const skuValue = values.sku.trim();
  const statusValue = DEFAULT_STATUS;
  const recordSource = options.recordSource ?? 'inventory-directory';
  const actorName = resolveCurrentActorName();
  const photographedAt = new Date().toISOString();

  if (recordId) {
    try {
      if (recordSource !== 'used-gear-workflow') {
        throw new Error('Photos forms require an approved workflow item and cannot be opened as a blank or inventory-only form.');
      }

      const workflowRecord = await getConfiguredRecord('used-gear-workflow', recordId);
      assertApprovedPhotosWorkflowRecord(workflowRecord);
      if (options.completeWorkflowStage) {
        assertPhotographyStageReadyForCompletion(workflowRecord);
      }
      const baseFields = compactFields({
        SKU: skuValue,
        'Item Title': buildUsedGearItemTitle({
          make: values.make,
          model: values.model,
          componentType: values.componentType,
          serialNumber: extractInventoryScalarValue(workflowRecord.fields['Serial Number']),
          jotFormSubmissionId: extractInventoryScalarValue(workflowRecord.fields['JotForm Submission ID']),
          pickUpId: extractInventoryScalarValue(workflowRecord.fields['Pick Up ID']),
          submissionGroupId: extractInventoryScalarValue(workflowRecord.fields['Submission Group ID']),
          recordId,
        }),
        Make: trimToUndefined(values.make),
        Model: trimToUndefined(values.model),
        'Component Type': arrayOrUndefined(values.componentType),
        'Original Box': arrayOrUndefined(values.originalBox),
        Manual: arrayOrUndefined(values.manual),
        Remote: arrayOrUndefined(values.remote),
        'Power Cable': arrayOrUndefined(values.powerCable),
        'Additional Items': trimToUndefined(values.additionalItems),
        'Audiogon Rating': arrayOrUndefined(values.audiogonRating),
        [PHOTOGRAPHY_COSMETIC_NOTES_FIELD_NAME]: trimToUndefined(values.cosmeticConditionNotes),
        "Photo'd": trimToUndefined(values.photoDate),
        Status: statusValue,
        [WORKFLOW_IMAGE_METADATA_FIELD_NAME]: options.imageMetadata ? serializeWorkflowImageMetadata(options.imageMetadata) : undefined,
        ...(options.completeWorkflowStage ? buildWorkflowPhotographyFields(workflowRecord, actorName, photographedAt) : {}),
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
                  stage: 'photos',
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
        sku: skuValue,
        action: 'updated',
      };
    } catch (error) {
      logServiceError('photosForm', `Error updating Photos form submission ${recordId}`, error);
      const serviceError = createServiceError({
        service: 'photosForm',
        code: 'PHOTOS_FORM_UPDATE_FAILED',
        userMessage: 'Unable to update the Photos fields for this workflow item.',
        retryable: true,
        cause: error,
      });
      const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
      typedError.serviceError = serviceError;
      throw typedError;
    }
  }

  logServiceError('photosForm', 'Error updating Photos form submission', new Error('Missing workflow record id for Photos form.'));
  const serviceError = createServiceError({
    service: 'photosForm',
    code: 'PHOTOS_FORM_UPDATE_FAILED',
    userMessage: 'Unable to update the Photos fields for this workflow item.',
    retryable: true,
    cause: new Error('Missing workflow record id for Photos form.'),
  });
  const typedError = new Error(serviceError.userMessage) as Error & { serviceError?: ServiceError };
  typedError.serviceError = serviceError;
  throw typedError;
}