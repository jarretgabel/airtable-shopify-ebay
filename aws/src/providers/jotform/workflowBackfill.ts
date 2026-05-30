import type { AirtableRecord } from '../airtable/client.js';
import { getConfiguredRecords, updateConfiguredRecord } from '../airtable/sources.js';
import { getSubmission } from './client.js';
import { mapJotFormSubmissionToWorkflowItems } from './workflowIngestMapper.js';
import {
  archiveIntakeImagesForRecord,
  parseWorkflowImageMetadata,
  replaceIntakeImageMetadata,
  serializeWorkflowImageMetadata,
  type WorkflowImageMetadataRecord,
} from './workflowIngest.js';
import { logError, logInfo } from '../../shared/logging.js';

export interface BackfillIntakeImagesOptions {
  /** Skip records that already have intake-stage images in Workflow Image Metadata JSON. Default: true. */
  skipIfAlreadyBackfilled?: boolean;
}

export interface BackfillIntakeImagesRecordResult {
  recordId: string;
  slotSubmissionId: string;
  jotFormSubmissionId: string;
  action: 'backfilled' | 'skipped' | 'no_images' | 'failed';
  imageCount: number;
  error?: string;
}

export interface BackfillIntakeImagesResult {
  total: number;
  backfilled: number;
  skipped: number;
  noImages: number;
  failed: number;
  results: BackfillIntakeImagesRecordResult[];
}

function readStringField(record: AirtableRecord, fieldName: string): string {
  const value = record.fields[fieldName];
  if (typeof value === 'string') return value.trim();
  return '';
}

/** Extract the root JotForm API submission ID from the per-slot ID stored in Airtable.
 *  New format: `{submissionId}-slot{N}` → `{submissionId}`
 *  Old format: bare submission ID (no slot suffix) → returned as-is. */
function extractJotFormSubmissionId(slotSubmissionId: string): string {
  const match = slotSubmissionId.match(/^(.+)-slot\d+$/);
  return match?.[1] ?? slotSubmissionId;
}

/** Returns true when the stored ID has no `-slot{N}` suffix (records ingested
 *  before per-slot tracking was introduced). */
function isOldFormatSubmissionId(slotSubmissionId: string): boolean {
  return !/-slot\d+$/.test(slotSubmissionId);
}

function hasIntakeImages(metadata: WorkflowImageMetadataRecord[]): boolean {
  return metadata.some((entry) => entry.sourceStage === 'intake');
}

/** Fetch all workflow records that have a JotForm Submission ID. */
async function loadJotFormWorkflowRecords(): Promise<AirtableRecord[]> {
  const records = await getConfiguredRecords('used-gear-workflow', {
    fields: ['JotForm Submission ID', 'Workflow Image Metadata JSON'],
  });

  return records.filter((record) => readStringField(record, 'JotForm Submission ID').length > 0);
}

export async function backfillIntakeImages(
  options: BackfillIntakeImagesOptions = {},
): Promise<BackfillIntakeImagesResult> {
  const skipIfAlreadyBackfilled = options.skipIfAlreadyBackfilled ?? true;

  const allRecords = await loadJotFormWorkflowRecords();

  // Determine which records need processing.
  const targetRecords = allRecords.filter((record) => {
    if (!skipIfAlreadyBackfilled) return true;
    const metadata = parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']);
    return !hasIntakeImages(metadata);
  });

  logInfo('JotForm intake image backfill started', {
    totalJotFormRecords: allRecords.length,
    targetRecords: targetRecords.length,
    skipIfAlreadyBackfilled,
  });

  // Group target records by root JotForm submission ID to batch API calls.
  const bySubmissionId = new Map<string, AirtableRecord[]>();
  for (const record of targetRecords) {
    const slotId = readStringField(record, 'JotForm Submission ID');
    const submissionId = extractJotFormSubmissionId(slotId);
    const group = bySubmissionId.get(submissionId) ?? [];
    group.push(record);
    bySubmissionId.set(submissionId, group);
  }

  const results: BackfillIntakeImagesRecordResult[] = [];

  for (const [jotFormSubmissionId, records] of bySubmissionId.entries()) {
    let submissionItems: ReturnType<typeof mapJotFormSubmissionToWorkflowItems>;

    try {
      const submission = await getSubmission(jotFormSubmissionId);
      submissionItems = mapJotFormSubmissionToWorkflowItems(submission);
    } catch (error) {
      logError('Failed to fetch JotForm submission during backfill', error, { jotFormSubmissionId });
      for (const record of records) {
        results.push({
          recordId: record.id,
          slotSubmissionId: readStringField(record, 'JotForm Submission ID'),
          jotFormSubmissionId,
          action: 'failed',
          imageCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    for (const record of records) {
      const slotSubmissionId = readStringField(record, 'JotForm Submission ID');

      // For new-format records, find the exact matching slot item.
      // For old-format records (no -slot{N} suffix), collect images from all
      // active items in the submission since the slot isn't tracked.
      let imageUrls: string[];
      if (isOldFormatSubmissionId(slotSubmissionId)) {
        imageUrls = submissionItems.flatMap((item) => item.imageUrls);
      } else {
        const item = submissionItems.find((candidate) => candidate.submissionId === slotSubmissionId);
        imageUrls = item?.imageUrls ?? [];
      }

      if (imageUrls.length === 0) {
        results.push({
          recordId: record.id,
          slotSubmissionId,
          jotFormSubmissionId,
          action: 'no_images',
          imageCount: 0,
        });
        continue;
      }

      try {
        const archivedFiles = await archiveIntakeImagesForRecord(record.id, imageUrls);

        if (archivedFiles.length > 0) {
          const existingMetadata = parseWorkflowImageMetadata(record.fields['Workflow Image Metadata JSON']);
          await updateConfiguredRecord(
            'used-gear-workflow',
            record.id,
            {
              'Workflow Image Metadata JSON': serializeWorkflowImageMetadata(
                replaceIntakeImageMetadata(existingMetadata, archivedFiles),
              ),
            },
            { typecast: true },
          );
        }

        logInfo('Backfilled intake images for record', {
          recordId: record.id,
          slotSubmissionId,
          imageCount: archivedFiles.length,
        });

        results.push({
          recordId: record.id,
          slotSubmissionId,
          jotFormSubmissionId,
          action: 'backfilled',
          imageCount: archivedFiles.length,
        });
      } catch (error) {
        logError('Failed to backfill intake images for record', error, { recordId: record.id, slotSubmissionId });
        results.push({
          recordId: record.id,
          slotSubmissionId,
          jotFormSubmissionId,
          action: 'failed',
          imageCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const summary: BackfillIntakeImagesResult = {
    total: targetRecords.length,
    backfilled: results.filter((r) => r.action === 'backfilled').length,
    skipped: results.filter((r) => r.action === 'skipped').length,
    noImages: results.filter((r) => r.action === 'no_images').length,
    failed: results.filter((r) => r.action === 'failed').length,
    results,
  };

  logInfo('JotForm intake image backfill complete', {
    total: summary.total,
    backfilled: summary.backfilled,
    noImages: summary.noImages,
    failed: summary.failed,
  });

  return summary;
}
