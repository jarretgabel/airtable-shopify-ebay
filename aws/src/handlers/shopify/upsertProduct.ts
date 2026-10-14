import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { publishProductToOnlineStore, upsertProductWithUnifiedRequest, type ShopifyUnifiedProductSetRequest } from '../../providers/shopify/client.js';

interface UpsertProductBody {
  request?: ShopifyUnifiedProductSetRequest;
  action?: 'publish-online-store';
  productId?: number;
}

interface UpsertProductDependencies {
  requireRouteAccess: typeof requireRouteAccess;
  upsertProductWithUnifiedRequest: typeof upsertProductWithUnifiedRequest;
  publishProductToOnlineStore: typeof publishProductToOnlineStore;
}

export function createHandler(dependencies: UpsertProductDependencies = {
  requireRouteAccess, upsertProductWithUnifiedRequest, publishProductToOnlineStore,
}) {
  return async function upsertProductHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await dependencies.requireRouteAccess(event);
      const body = requireJsonBody<UpsertProductBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
      if (body.action !== undefined) {
        if (body.action !== 'publish-online-store' || body.request || typeof body.productId !== 'number' || !Number.isSafeInteger(body.productId) || body.productId <= 0) {
          throw new HttpError(400, 'publish-online-store requires a positive productId and no product-set request.', {
            service: 'shopify', code: 'INVALID_SHOPIFY_PUBLICATION_REQUEST', retryable: false,
          });
        }
        const product = await dependencies.publishProductToOnlineStore(body.productId);
        logInfo('Published existing Shopify product to Online Store', { productId: product.id });
        return jsonOk(product, { origin });
      }
      if (!body.request) {
        return jsonError(400, toApiErrorBody('shopify', new Error('request is required'), 'MISSING_PRODUCT_SET_REQUEST'), { origin });
      }

      const product = await dependencies.upsertProductWithUnifiedRequest(body.request);
      logInfo('Upserted Shopify product', { productId: product.id, title: product.title });
      return jsonOk(product, { origin });
    } catch (error) {
      logError('Failed to upsert Shopify product', error);
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_UPSERT_PRODUCT_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();