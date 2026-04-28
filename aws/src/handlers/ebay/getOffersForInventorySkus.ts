import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOffersForInventorySkus } from '../../providers/ebay/client.js';

interface GetOffersForInventorySkusBody {
  skus?: string[];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<GetOffersForInventorySkusBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    if (!Array.isArray(body.skus)) {
      return jsonError(400, toApiErrorBody('ebay', new Error('skus must be an array'), 'INVALID_SKUS'));
    }

    const page = await getOffersForInventorySkus(body.skus);
    logInfo('Fetched eBay offers for inventory skus', { skuCount: body.skus.length, offerCount: page.offers.length });
    return jsonOk(page);
  } catch (error) {
    logError('Failed to fetch eBay offers for inventory skus', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_OFFERS_FOR_SKUS_FAILED'));
  }
}