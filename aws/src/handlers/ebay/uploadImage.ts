import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { uploadImageToEbayHostedPictures } from '../../providers/ebay/client.js';

interface UploadImageBody {
  filename?: string;
  mimeType?: string;
  file?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<UploadImageBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const filename = body.filename?.trim();
    const mimeType = body.mimeType?.trim() || 'image/jpeg';
    const file = body.file?.trim();

    if (!filename || !file) {
      return jsonError(400, toApiErrorBody('ebay', new Error('filename and file are required'), 'INVALID_IMAGE_UPLOAD_PAYLOAD'));
    }

    const result = await uploadImageToEbayHostedPictures(filename, mimeType, file);
    logInfo('Uploaded eBay hosted picture', { filename });
    return jsonOk(result);
  } catch (error) {
    logError('Failed to upload eBay hosted picture', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_UPLOAD_IMAGE_FAILED'));
  }
}