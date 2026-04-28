import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getEbayRootCategories } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const categories = await getEbayRootCategories(marketplaceId);
    logInfo('Fetched eBay root categories', { count: categories.length, marketplaceId });
    return jsonOk(categories);
  } catch (error) {
    logError('Failed to fetch eBay root categories', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_ROOT_CATEGORIES_FAILED'));
  }
}