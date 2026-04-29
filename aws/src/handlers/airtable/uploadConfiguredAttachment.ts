import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { uploadConfiguredAttachment, type AirtableConfiguredAttachmentSource } from '../../providers/airtable/sources.js';

interface AttachmentBody {
  filename?: string;
  contentType?: string;
  file?: string;
}

function validateSource(value: string): AirtableConfiguredAttachmentSource {
  if (value === 'inventory-directory') {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable attachment source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    const fieldId = requirePathParam(event, 'fieldId', 'airtable', 'MISSING_FIELD_ID');
    const body = requireJsonBody<AttachmentBody>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');

    if (!body.filename?.trim() || !body.file?.trim()) {
      return jsonError(400, {
        message: 'filename and file are required',
        service: 'airtable',
        code: 'INVALID_AIRTABLE_ATTACHMENT_PAYLOAD',
        retryable: false,
      }, { origin });
    }

    await uploadConfiguredAttachment(source, recordId, fieldId, {
      filename: body.filename.trim(),
      contentType: body.contentType?.trim() || 'application/octet-stream',
      file: body.file.trim(),
    });
    logInfo('Uploaded Airtable configured attachment', { source, recordId, fieldId });
    return jsonOk({ uploaded: true }, { origin });
  } catch (error) {
    logError('Failed to upload Airtable configured attachment', error, {
      source: event.pathParameters?.source || '',
      recordId: event.pathParameters?.recordId || '',
      fieldId: event.pathParameters?.fieldId || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_UPLOAD_ATTACHMENT_FAILED'), { origin });
  }
}