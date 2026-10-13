import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { detectSupportedImageMimeType } from '../../shared/imageFormat.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getConfiguredRecord, type AirtableConfiguredRecordsSource } from '../../providers/airtable/sources.js';
import { downloadGoogleDriveFile, extractGoogleDriveFileId } from '../../providers/googleDrive/client.js';
import { parseWorkflowImageMetadata } from '../../shared/workflowImages.js';

function validateSource(value: string): AirtableConfiguredRecordsSource {
  if (
    value === 'users'
    || value === 'inventory-directory'
    || value === 'used-gear-workflow'
    || value === 'approval-ebay'
    || value === 'approval-shopify'
    || value === 'approval-combined'
    || value === 'shopify-vendors'
  ) {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable configured source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

function getWorkflowImageMetadata(fields: Record<string, unknown>): unknown {
  const metadataFieldNames = new Set([
    'workflowimagemetadatajson',
    'workflowimagemetadata',
    'imagemetadatajson',
  ]);
  const fieldName = Object.keys(fields).find((name) => (
    metadataFieldNames.has(name.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
  ));
  return fieldName ? fields[fieldName] : undefined;
}

async function getWorkflowImagePreview(
  fields: Record<string, unknown>,
  imageId: string,
): Promise<{ dataUrl: string }> {
  if (!/^[a-z0-9_-]{10,200}$/i.test(imageId)) {
    throw new HttpError(400, 'A valid Google Drive image id is required.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_ID_INVALID',
      retryable: false,
    });
  }

  const metadata = parseWorkflowImageMetadata(getWorkflowImageMetadata(fields));
  const belongsToRecord = metadata.some((image) => extractGoogleDriveFileId(image.url) === imageId);
  if (!belongsToRecord) {
    throw new HttpError(404, 'The requested image is not attached to this workflow record.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_NOT_FOUND',
      retryable: false,
    });
  }

  const { bytes } = await downloadGoogleDriveFile(imageId);
  const mimeType = detectSupportedImageMimeType(bytes);
  if (!mimeType) {
    throw new HttpError(415, 'The workflow image is not in a supported image format.', {
      service: 'airtable',
      code: 'WORKFLOW_IMAGE_FORMAT_UNSUPPORTED',
      retryable: false,
    });
  }

  return { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}` };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    const record = await getConfiguredRecord(source, recordId);
    const imageId = event.queryStringParameters?.imageId?.trim();
    if (imageId) {
      const preview = await getWorkflowImagePreview(record.fields, imageId);
      logInfo('Loaded authenticated workflow image preview', { source, recordId, imageId });
      return jsonOk(preview, { origin });
    }

    logInfo('Fetched Airtable configured record', { source, recordId: record.id });
    return jsonOk(record, { origin });
  } catch (error) {
    logError('Failed to fetch Airtable configured record', error, {
      source: event.pathParameters?.source || '',
      recordId: event.pathParameters?.recordId || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_RECORD_FAILED'), { origin });
  }
}