import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { upsertProductWithUnifiedRequest, type ShopifyUnifiedProductSetRequest } from '../../providers/shopify/client.js';

interface UpsertProductBody {
  request?: ShopifyUnifiedProductSetRequest;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<UpsertProductBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
    if (!body.request) {
      return jsonError(400, toApiErrorBody('shopify', new Error('request is required'), 'MISSING_PRODUCT_SET_REQUEST'), { origin });
    }

    const product = await upsertProductWithUnifiedRequest(body.request);
    logInfo('Upserted Shopify product', { productId: product.id, title: product.title });
    return jsonOk(product, { origin });
  } catch (error) {
    logError('Failed to upsert Shopify product', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_UPSERT_PRODUCT_FAILED'), { origin });
  }
}