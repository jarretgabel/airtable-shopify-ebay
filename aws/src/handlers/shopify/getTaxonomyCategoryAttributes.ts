import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getTaxonomyCategoryAttributes } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const categoryId = requireQueryParam(event, 'categoryId', 'shopify', 'MISSING_CATEGORY_ID');
    const categorySearch = requireQueryParam(event, 'categorySearch', 'shopify', 'MISSING_CATEGORY_SEARCH');
    const attributes = await getTaxonomyCategoryAttributes(categoryId, categorySearch);
    logInfo('Loaded Shopify taxonomy category attributes', { categoryId, count: attributes.length });
    return jsonOk(attributes, { origin });
  } catch (error) {
    logError('Failed to load Shopify taxonomy category attributes', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_TAXONOMY_ATTRIBUTES_FAILED'), { origin });
  }
}