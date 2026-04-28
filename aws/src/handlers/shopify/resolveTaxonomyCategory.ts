import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { resolveTaxonomyCategory } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const searchOrId = requireQueryParam(event, 'searchOrId', 'shopify', 'MISSING_SEARCH_OR_ID');
    const match = await resolveTaxonomyCategory(searchOrId);
    logInfo('Resolved Shopify taxonomy category', { found: Boolean(match) });
    return jsonOk(match);
  } catch (error) {
    logError('Failed to resolve Shopify taxonomy category', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_RESOLVE_TAXONOMY_FAILED'));
  }
}