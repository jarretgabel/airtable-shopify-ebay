import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getProduct, getProductShippingInspection } from '../../providers/shopify/client.js';

interface Dependencies {
  requireRouteAccess?: typeof requireRouteAccess;
  getProduct?: typeof getProduct;
  getProductShippingInspection?: typeof getProductShippingInspection;
}

export function createHandler(dependencies: Dependencies = {}) {
  const requireAccess = dependencies.requireRouteAccess ?? requireRouteAccess;
  const readProduct = dependencies.getProduct ?? getProduct;
  const inspectShipping = dependencies.getProductShippingInspection ?? getProductShippingInspection;
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const origin = getRequestOrigin(event);
    try {
      await requireAccess(event);
      const rawProductId = requirePathParam(event, 'productId', 'shopify', 'MISSING_PRODUCT_ID');
      const productId = Number(rawProductId);
      if (!Number.isInteger(productId) || productId <= 0) {
        return jsonError(400, toApiErrorBody('shopify', new Error('productId must be a positive integer'), 'INVALID_PRODUCT_ID'), { origin });
      }
      const view = event.queryStringParameters?.view;
      if (view && view !== 'shipping') {
        throw new HttpError(400, 'Unsupported Shopify product view.', {
          service: 'shopify', code: 'INVALID_PRODUCT_VIEW', retryable: false,
        });
      }
      const product = view === 'shipping' ? await inspectShipping(productId) : await readProduct(productId);
      logInfo('Fetched Shopify product', { productId, found: Boolean(product) });
      return jsonOk(product, { origin });
    } catch (error) {
      logError('Failed to fetch Shopify product', error);
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_GET_PRODUCT_FAILED'), { origin });
    }
  };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return createHandler()(event);
}