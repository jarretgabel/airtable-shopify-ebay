import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getProduct } from '../../providers/shopify/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const rawProductId = requirePathParam(event, 'productId', 'shopify', 'MISSING_PRODUCT_ID');
    const productId = Number(rawProductId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return jsonError(400, toApiErrorBody('shopify', new Error('productId must be a positive integer'), 'INVALID_PRODUCT_ID'), { origin });
    }

    const product = await getProduct(productId);
    logInfo('Fetched Shopify product', { productId, found: Boolean(product) });
    return jsonOk(product, { origin });
  } catch (error) {
    logError('Failed to fetch Shopify product', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_GET_PRODUCT_FAILED'), { origin });
  }
}