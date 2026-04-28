import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getOffers } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const sku = getOptionalQueryParam(event, 'sku');
    const limit = readIntegerQueryParam(event, 'limit', {
      defaultValue: 25,
      min: 1,
      max: 200,
      service: 'ebay',
      code: 'INVALID_LIMIT',
    });

    const page = await getOffers(sku, limit);
    logInfo('Fetched eBay offers', { count: page.offers.length, total: page.total, limit, sku: sku ?? '' });
    return jsonOk(page);
  } catch (error) {
    logError('Failed to fetch eBay offers', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_OFFERS_FAILED'));
  }
}