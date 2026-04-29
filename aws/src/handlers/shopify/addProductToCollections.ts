import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { addProductToCollections } from '../../providers/shopify/client.js';

interface AddProductToCollectionsBody {
  collectionIds?: string[];
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const rawProductId = requirePathParam(event, 'productId', 'shopify', 'MISSING_PRODUCT_ID');
    const productId = Number(rawProductId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return jsonError(400, toApiErrorBody('shopify', new Error('productId must be a positive integer'), 'INVALID_PRODUCT_ID'), { origin });
    }

    const body = requireJsonBody<AddProductToCollectionsBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
    await addProductToCollections(productId, body.collectionIds ?? []);
    logInfo('Added Shopify product to collections', { productId, collectionCount: (body.collectionIds ?? []).length });
    return jsonOk({ assigned: true }, { origin });
  } catch (error) {
    logError('Failed to add Shopify product to collections', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_ADD_PRODUCT_TO_COLLECTIONS_FAILED'), { origin });
  }
}