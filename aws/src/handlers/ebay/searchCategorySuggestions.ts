import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { searchEbayCategorySuggestions } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const query = requireQueryParam(event, 'query', 'ebay', 'MISSING_QUERY');
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const suggestions = await searchEbayCategorySuggestions(query, marketplaceId);
    logInfo('Fetched eBay category suggestions', { count: suggestions.length, marketplaceId });
    return jsonOk(suggestions);
  } catch (error) {
    logError('Failed to fetch eBay category suggestions', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_SEARCH_CATEGORY_SUGGESTIONS_FAILED'));
  }
}