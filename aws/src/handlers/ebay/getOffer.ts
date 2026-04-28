import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOffer } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const offerId = requirePathParam(event, 'offerId', 'ebay', 'MISSING_OFFER_ID');
    const offer = await getOffer(offerId);
    logInfo('Fetched eBay offer details', { offerId });
    return jsonOk(offer);
  } catch (error) {
    logError('Failed to fetch eBay offer details', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_OFFER_FAILED'));
  }
}