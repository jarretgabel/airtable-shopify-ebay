import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getMediaStoreFromEnv } from '../../providers/media/mediaStore.js';
import {
  finalizeWorkflowImageUpload,
  presignWorkflowImageUpload,
  type DirectUploadFile,
} from '../../providers/media/workflowImageDirectUpload.js';

interface Body {
  folderKey?: string;
  stage?: unknown;
  files?: DirectUploadFile[];
  processedKey?: string;
  originalKey?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE');
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    const action = requirePathParam(event, 'action', 'airtable', 'MISSING_ACTION');
    if (source !== 'used-gear-workflow' && source !== 'inventory-directory') {
      throw new HttpError(400, 'Unsupported Airtable attachment source', { service: 'airtable', code: 'AIRTABLE_SOURCE_NOT_ALLOWED', retryable: false });
    }
    const body = requireJsonBody<Body>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');
    const media = process.env.IMAGE_ARCHIVE_BACKEND?.trim().toLowerCase() === 's3' ? getMediaStoreFromEnv() : null;
    // Clients fall back to the base64 upload when direct upload is not on.
    if (!media) return jsonOk({ enabled: false }, { origin });

    const recordKey = body.folderKey?.trim() || recordId;
    if (action === 'presign') {
      const uploads = await presignWorkflowImageUpload({ recordKey, stage: body.stage, files: body.files ?? [] }, media);
      logInfo('Issued workflow image upload URLs', { source, recordId, count: uploads.length });
      return jsonOk({ enabled: true, uploads }, { origin });
    }
    if (action === 'finalize') {
      const archive = await finalizeWorkflowImageUpload({
        recordKey, stage: body.stage, processedKey: body.processedKey?.trim() ?? '', originalKey: body.originalKey?.trim() || undefined,
      }, media);
      logInfo('Finalized workflow image upload', { source, recordId, key: archive.processed.id });
      return jsonOk({ uploaded: false, archived: true, archive }, { origin });
    }
    return jsonError(404, { message: 'Unknown action', service: 'airtable', code: 'DIRECT_UPLOAD_ACTION_UNKNOWN', retryable: false }, { origin });
  } catch (error) {
    logError('Direct workflow image upload failed', error, { recordId: event.pathParameters?.recordId || '' });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'DIRECT_WORKFLOW_IMAGE_UPLOAD_FAILED'), { origin });
  }
}
