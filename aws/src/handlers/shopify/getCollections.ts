import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getCollections } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const first = readIntegerQueryParam(event, 'first', {
      defaultValue: 250,
      min: 1,
      max: 250,
      service: 'shopify',
      code: 'INVALID_FIRST',
    });

    const collections = await getCollections(first);
    logInfo('Fetched Shopify collections', { count: collections.length, first });
    return jsonOk(collections, { origin });
  } catch (error) {
    logError('Failed to fetch Shopify collections', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_GET_COLLECTIONS_FAILED'), { origin });
  }
}