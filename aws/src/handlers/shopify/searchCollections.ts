import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { searchCollections } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const search = getOptionalQueryParam(event, 'search') ?? '';
    const first = readIntegerQueryParam(event, 'first', {
      defaultValue: 250,
      min: 1,
      max: 250,
      service: 'shopify',
      code: 'INVALID_FIRST',
    });

    const collections = await searchCollections(search, first);
    logInfo('Searched Shopify collections', { count: collections.length, first, hasSearch: search.length > 0 });
    return jsonOk(collections);
  } catch (error) {
    logError('Failed to search Shopify collections', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_SEARCH_COLLECTIONS_FAILED'));
  }
}