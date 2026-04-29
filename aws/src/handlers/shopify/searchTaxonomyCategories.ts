import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, requireQueryParam, jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { searchTaxonomyCategories } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const search = requireQueryParam(event, 'search', 'shopify', 'MISSING_SEARCH');
    const first = readIntegerQueryParam(event, 'first', {
      defaultValue: 10,
      min: 1,
      max: 50,
      service: 'shopify',
      code: 'INVALID_FIRST',
    });

    const matches = await searchTaxonomyCategories(search, first);
    logInfo('Searched Shopify taxonomy categories', { count: matches.length, first });
    return jsonOk(matches, { origin });
  } catch (error) {
    logError('Failed to search Shopify taxonomy categories', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_SEARCH_TAXONOMY_FAILED'), { origin });
  }
}