import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getEbayCategory } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const categoryId = requireQueryParam(event, 'categoryId', 'ebay', 'MISSING_CATEGORY_ID');
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const category = await getEbayCategory(categoryId, marketplaceId);
    logInfo('Fetched eBay category', { categoryId, found: Boolean(category), marketplaceId });
    return jsonOk(category, { origin });
  } catch (error) {
    logError('Failed to fetch eBay category', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_CATEGORY_FAILED'), { origin });
  }
}