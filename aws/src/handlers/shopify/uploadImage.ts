import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { uploadImageFile } from '../../providers/shopify/client.js';

interface UploadImageBody {
  filename?: string;
  mimeType?: string;
  file?: string;
  alt?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<UploadImageBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
    const filename = body.filename?.trim();
    const mimeType = body.mimeType?.trim() || 'image/jpeg';
    const file = body.file?.trim();

    if (!filename || !file) {
      return jsonError(400, toApiErrorBody('shopify', new Error('filename and file are required'), 'INVALID_IMAGE_UPLOAD_PAYLOAD'), { origin });
    }

    const result = await uploadImageFile(filename, mimeType, file, body.alt);
    logInfo('Uploaded Shopify image', { filename });
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to upload Shopify image', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_UPLOAD_IMAGE_FAILED'), { origin });
  }
}