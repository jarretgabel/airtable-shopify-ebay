import type { AirtableRecord } from '../airtable/client.js';
import {
  createConfiguredRecord,
  getConfiguredRecords,
  updateConfiguredRecord,
} from '../airtable/sources.js';
import { archiveWorkflowImagesToGoogleDrive } from '../googleDrive/client.js';
import { getSubmission, type JotFormSubmission } from './client.js';
import { mapJotFormSubmissionToWorkflowItems } from './workflowIngestMapper.js';
import { buildUsedGearItemTitle } from '../../shared/contracts/usedGearItemTitle.js';
import { normalizeProductImageFilename } from '../../shared/imageNaming.js';
import { logError } from '../../shared/logging.js';

export interface JotFormWorkflowIngestItemResult {
  recordId: string;
  submissionId: string;
  action: 'created' | 'updated' | 'skipped';
  imageCount: number;
}

export interface JotFormWorkflowIngestResult {
  formId: string;
  submissionId: string;
  items: JotFormWorkflowIngestItemResult[];
}

export interface WorkflowImageMetadataRecord {
  attachmentId?: string;
  url: string;
  filename: string;
  alt: string;
  sortOrder: number;
  sourceStage: 'intake' | 'testing' | 'photos';
  includedInListing: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkflowIngestDependencies {
  getSubmission?: typeof getSubmission;
  getConfiguredRecords?: typeof getConfiguredRecords;
  createConfiguredRecord?: typeof createConfiguredRecord;
  updateConfiguredRecord?: typeof updateConfiguredRecord;
  archiveIntakeImagesForRecord?: (recordId: string, imageUrls: string[]) => Promise<Array<{ id: string; url: string; filename: string }>>;
}

function readStringField(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const firstString = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return firstString?.trim() || '';
  }

  return '';
}

function canRefreshPendingReview(record: AirtableRecord): boolean {
  return readStringField(record, 'Workflow Status') === 'Pending Review';
}

export function parseWorkflowImageMetadata(raw: unknown): WorkflowImageMetadataRecord[] {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, index): WorkflowImageMetadataRecord => {
        const sourceStage: WorkflowImageMetadataRecord['sourceStage'] = entry.sourceStage === 'intake' || entry.sourceStage === 'testing'
          ? entry.sourceStage
          : 'photos';

        return {
          attachmentId: typeof entry.attachmentId === 'string' ? entry.attachmentId.trim() : undefined,
          url: typeof entry.url === 'string' ? entry.url.trim() : '',
          filename: typeof entry.filename === 'string' ? entry.filename.trim() : `Image ${index + 1}`,
          alt: typeof entry.alt === 'string' ? entry.alt.trim() : '',
          sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : index + 1,
          sourceStage,
          includedInListing: typeof entry.includedInListing === 'boolean' ? entry.includedInListing : true,
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt.trim() : undefined,
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt.trim() : undefined,
        };
      })
      .filter((entry) => entry.url.length > 0);
  } catch {
    return [];
  }
}

export function serializeWorkflowImageMetadata(records: WorkflowImageMetadataRecord[]): string {
  if (records.length === 0) {
    return '';
  }

  return JSON.stringify(records.map((record, index) => ({
    ...record,
    sortOrder: index + 1,
  })));
}

export function replaceIntakeImageMetadata(
  existingRecords: WorkflowImageMetadataRecord[],
  nextIntakeFiles: Array<{ id: string; url: string; filename: string }>,
): WorkflowImageMetadataRecord[] {
  const nowIso = new Date().toISOString();
  const nextIntakeRecords = nextIntakeFiles.map((file, index) => ({
    attachmentId: file.id,
    url: file.url,
    filename: file.filename,
    alt: '',
    sortOrder: index + 1,
    sourceStage: 'intake' as const,
    includedInListing: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  }));

  return [
    ...nextIntakeRecords,
    ...existingRecords.filter((record) => record.sourceStage !== 'intake'),
  ].map((record, index) => ({
    ...record,
    sortOrder: index + 1,
  }));
}

function buildImageFilename(url: string, fallback: string): string {
  try {
    const parsed = new URL(url);
    const pathName = parsed.pathname.split('/').pop()?.trim();
    if (pathName) {
      return normalizeProductImageFilename(decodeURIComponent(pathName));
    }
  } catch {
    // Ignore URL parsing failures and fall back.
  }

  return normalizeProductImageFilename(fallback);
}

function buildWorkflowItemTitle(fields: Record<string, unknown>, recordId: string): string {
  return buildUsedGearItemTitle({
    make: readStringField({ fields } as AirtableRecord, 'Make'),
    model: readStringField({ fields } as AirtableRecord, 'Model'),
    componentType: readStringField({ fields } as AirtableRecord, 'Component Type'),
    recordId,
  });
}

async function fetchRemoteFileAsArchivePayload(url: string, fallbackName: string): Promise<{ filename: string; contentType: string; file: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch remote file (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type')?.trim() || 'application/octet-stream';
  const filename = buildImageFilename(url, fallbackName);

  return {
    filename,
    contentType,
    file: fileBuffer.toString('base64'),
  };
}

export async function archiveIntakeImagesForRecord(recordId: string, imageUrls: string[]): Promise<Array<{ id: string; url: string; filename: string }>> {
  const archivedFiles: Array<{ id: string; url: string; filename: string }> = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      const original = await fetchRemoteFileAsArchivePayload(imageUrl, `intake-${index + 1}.jpg`);
      const archiveResult = await archiveWorkflowImagesToGoogleDrive({
        folderKey: recordId,
        stage: 'intake',
        original,
        processed: original,
      });
      archivedFiles.push(archiveResult.original);
    } catch (error) {
      logError('Failed to archive JotForm intake image', error, { recordId, imageUrl });
    }
  }

  return archivedFiles;
}

async function findExistingSubmissionRecord(
  submissionId: string,
  listRecords: typeof getConfiguredRecords,
): Promise<AirtableRecord | null> {
  const records = await listRecords('used-gear-workflow', {
    fields: ['JotForm Submission ID', 'Workflow Status', 'Workflow Image Metadata JSON'],
  });

  return records.find((record) => readStringField(record, 'JotForm Submission ID') === submissionId) ?? null;
}

export function createIngestJotFormSubmissionWorkflow(dependencies: WorkflowIngestDependencies = {}) {
  const fetchSubmission = dependencies.getSubmission ?? getSubmission;
  const listRecords = dependencies.getConfiguredRecords ?? getConfiguredRecords;
  const createRecord = dependencies.createConfiguredRecord ?? createConfiguredRecord;
  const updateRecord = dependencies.updateConfiguredRecord ?? updateConfiguredRecord;
  const archiveImages = dependencies.archiveIntakeImagesForRecord ?? archiveIntakeImagesForRecord;

  return async function ingestJotFormSubmissionWorkflow(
    formId: string,
    submissionId: string,
  ): Promise<JotFormWorkflowIngestResult> {
    const submission = await fetchSubmission(submissionId);
    const effectiveSubmission = submission.form_id === formId
      ? submission
      : ({ ...submission, form_id: formId } satisfies JotFormSubmission);

    const items = mapJotFormSubmissionToWorkflowItems(effectiveSubmission);
    const results: JotFormWorkflowIngestItemResult[] = [];

    for (const item of items) {
      const existingRecord = await findExistingSubmissionRecord(item.submissionId, listRecords);

      if (!existingRecord) {
        const createdRecord = await createRecord('used-gear-workflow', item.airtableFields, { typecast: true });
        const nextItemTitle = buildWorkflowItemTitle(createdRecord.fields, createdRecord.id);
        if (createdRecord.fields['Item Title'] !== nextItemTitle) {
          await updateRecord('used-gear-workflow', createdRecord.id, {
            'Item Title': nextItemTitle,
          }, { typecast: true });
        }
        const archivedIntakeFiles = await archiveImages(createdRecord.id, item.imageUrls);
        if (archivedIntakeFiles.length > 0) {
          await updateRecord('used-gear-workflow', createdRecord.id, {
            'Workflow Image Metadata JSON': serializeWorkflowImageMetadata(
              replaceIntakeImageMetadata([], archivedIntakeFiles),
            ),
          }, { typecast: true });
        }
        results.push({
          recordId: createdRecord.id,
          submissionId: item.submissionId,
          action: 'created',
          imageCount: item.imageUrls.length,
        });
        continue;
      }

      if (canRefreshPendingReview(existingRecord)) {
        const updatedRecord = await updateRecord('used-gear-workflow', existingRecord.id, {
          ...item.airtableFields,
          'Item Title': buildWorkflowItemTitle(item.airtableFields, existingRecord.id),
        }, { typecast: true });
        const archivedIntakeFiles = await archiveImages(updatedRecord.id, item.imageUrls);
        if (archivedIntakeFiles.length > 0) {
          const existingMetadata = parseWorkflowImageMetadata(existingRecord.fields['Workflow Image Metadata JSON']);
          await updateRecord('used-gear-workflow', updatedRecord.id, {
            'Workflow Image Metadata JSON': serializeWorkflowImageMetadata(
              replaceIntakeImageMetadata(existingMetadata, archivedIntakeFiles),
            ),
          }, { typecast: true });
        }
        results.push({
          recordId: updatedRecord.id,
          submissionId: item.submissionId,
          action: 'updated',
          imageCount: item.imageUrls.length,
        });
        continue;
      }

      results.push({
        recordId: existingRecord.id,
        submissionId: item.submissionId,
        action: 'skipped',
        imageCount: item.imageUrls.length,
      });
    }

    return {
      formId,
      submissionId,
      items: results,
    };
  };
}

export async function ingestJotFormSubmissionWorkflow(
  formId: string,
  submissionId: string,
): Promise<JotFormWorkflowIngestResult> {
  return createIngestJotFormSubmissionWorkflow()(formId, submissionId);
}