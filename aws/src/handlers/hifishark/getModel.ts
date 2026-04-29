import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getListingsForSlug } from '../../providers/hifishark/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const slug = requirePathParam(event, 'slug', 'hifishark', 'MISSING_HIFISHARK_SLUG');
    const listings = await getListingsForSlug(slug);
    logInfo('Fetched HiFiShark listings', { slug, count: listings.length });
    return jsonOk(listings, { origin });
  } catch (error) {
    logError('Failed to fetch HiFiShark listings', error);
    return jsonError(getStatusCode(error), toApiErrorBody('hifishark', error, 'HIFISHARK_GET_MODEL_FAILED'), { origin });
  }
}