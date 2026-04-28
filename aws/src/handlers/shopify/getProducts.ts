import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getProducts } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const limit = readIntegerQueryParam(event, 'limit', {
      defaultValue: 50,
      min: 1,
      max: 250,
      service: 'shopify',
      code: 'INVALID_LIMIT',
    });

    const products = await getProducts(limit);
    logInfo('Fetched Shopify products', { count: products.length, limit });
    return jsonOk(products);
  } catch (error) {
    logError('Failed to fetch Shopify products', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_GET_PRODUCTS_FAILED'));
  }
}