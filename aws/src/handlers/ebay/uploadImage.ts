import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  uploadExternalImageUrlToEbayHostedPictures,
  uploadImageToEbayHostedPictures,
} from '../../providers/ebay/client.js';

interface UploadImageBody {
  filename?: string;
  mimeType?: string;
  file?: string;
  sourceUrl?: string;
  index?: number;
}

interface UploadImageDependencies {
  requireRouteAccess: typeof requireRouteAccess;
  uploadExternalImageUrlToEbayHostedPictures: typeof uploadExternalImageUrlToEbayHostedPictures;
  uploadImageToEbayHostedPictures: typeof uploadImageToEbayHostedPictures;
}

export function createHandler(dependencies: UploadImageDependencies = {
  requireRouteAccess,
  uploadExternalImageUrlToEbayHostedPictures,
  uploadImageToEbayHostedPictures,
}) {
  return async function uploadImageHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await dependencies.requireRouteAccess(event);
    const body = requireJsonBody<UploadImageBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const filename = body.filename?.trim();
    const mimeType = body.mimeType?.trim() || 'image/jpeg';
    const file = body.file?.trim();
    const sourceUrl = body.sourceUrl?.trim();

    if (sourceUrl) {
      const result = await dependencies.uploadExternalImageUrlToEbayHostedPictures(sourceUrl, body.index);
      logInfo('Uploaded external eBay hosted picture', { sourceUrl, index: body.index });
      return jsonOk(result, { origin });
    }

    if (!filename || !file) {
      return jsonError(400, toApiErrorBody('ebay', new Error('sourceUrl or filename and file are required'), 'INVALID_IMAGE_UPLOAD_PAYLOAD'), { origin });
    }

    const result = await dependencies.uploadImageToEbayHostedPictures(filename, mimeType, file);
    logInfo('Uploaded eBay hosted picture', { filename });
    return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to upload eBay hosted picture', error);
      return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_UPLOAD_IMAGE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();