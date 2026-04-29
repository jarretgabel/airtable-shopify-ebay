import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOffer } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const offerId = requirePathParam(event, 'offerId', 'ebay', 'MISSING_OFFER_ID');
    const offer = await getOffer(offerId);
    logInfo('Fetched eBay offer details', { offerId });
    return jsonOk(offer, { origin });
  } catch (error) {
    logError('Failed to fetch eBay offer details', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_OFFER_FAILED'), { origin });
  }
}