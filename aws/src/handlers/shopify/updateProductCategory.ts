import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { updateProductCategory } from '../../providers/shopify/client.js';

interface UpdateProductCategoryBody {
  categoryId?: string;
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

    const body = requireJsonBody<UpdateProductCategoryBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
    if (!body.categoryId?.trim()) {
      return jsonError(400, toApiErrorBody('shopify', new Error('categoryId is required'), 'MISSING_CATEGORY_ID'), { origin });
    }

    await updateProductCategory(productId, body.categoryId);
    logInfo('Updated Shopify product category', { productId });
    return jsonOk({ updated: true }, { origin });
  } catch (error) {
    logError('Failed to update Shopify product category', error);
    return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_UPDATE_PRODUCT_CATEGORY_FAILED'), { origin });
  }
}