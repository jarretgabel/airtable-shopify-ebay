import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  upsertExistingProductWithCollectionsInSingleMutation,
  type ShopifyUnifiedProductSetRequest,
} from '../../providers/shopify/client.js';

interface UpsertProductWithCollectionsBody {
  request?: ShopifyUnifiedProductSetRequest;
  collectionIds?: string[];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<UpsertProductWithCollectionsBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
    if (!body.request) {
      return jsonError(400, toApiErrorBody('shopify', new Error('request is required'), 'MISSING_PRODUCT_SET_REQUEST'), { origin });
    }

    const result = await upsertExistingProductWithCollectionsInSingleMutation(body.request, body.collectionIds ?? []);
    logInfo('Upserted Shopify product with collections', {
      productId: result.product.id,
      collectionFailures: result.collectionFailures.length,
    });
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to upsert Shopify product with collections', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_UPSERT_PRODUCT_WITH_COLLECTIONS_FAILED'), { origin });
  }
}