import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';
import { getMediaStoreFromEnv, isValidMediaKey } from '../../providers/media/mediaStore.js';

/**
 * Public on purpose: Shopify and eBay fetch these URLs when publishing. Keys contain a random attachment id,
 * which is the same protection Airtable's own attachment URLs relied on.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const key = (event.pathParameters?.key ?? '').split('/').map((part) => decodeURIComponent(part)).join('/');
    const media = getMediaStoreFromEnv();
    if (!media) {
      throw new HttpError(503, 'Media storage is not configured.', { service: 'media', code: 'MEDIA_NOT_CONFIGURED', retryable: false });
    }
    if (!isValidMediaKey(key)) {
      throw new HttpError(404, 'Not found.', { service: 'media', code: 'MEDIA_NOT_FOUND', retryable: false });
    }
    return {
      statusCode: 302,
      headers: { location: await media.signedUrl(key), 'cache-control': 'private, max-age=240' },
      body: '',
    };
  } catch (error) {
    logError('Failed to serve media', error, { key: event.pathParameters?.key ?? '' });
    return jsonError(getStatusCode(error), toApiErrorBody('media', error, 'MEDIA_FAILED'), { origin });
  }
}
