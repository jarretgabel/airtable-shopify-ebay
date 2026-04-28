import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getEbayChildCategories } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const parentCategoryId = requireQueryParam(event, 'parentCategoryId', 'ebay', 'MISSING_PARENT_CATEGORY_ID');
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const categories = await getEbayChildCategories(parentCategoryId, marketplaceId);
    logInfo('Fetched eBay child categories', { count: categories.length, marketplaceId, parentCategoryId });
    return jsonOk(categories);
  } catch (error) {
    logError('Failed to fetch eBay child categories', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_CHILD_CATEGORIES_FAILED'));
  }
}