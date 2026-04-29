import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';
import { buildShopifyApprovalPreviewFromFields } from '../../providers/shopify/approvalPreview.js';

interface GetShopifyApprovalPreviewBody {
  fields?: Record<string, unknown>;
}

interface GetShopifyApprovalPreviewDependencies {
  buildShopifyApprovalPreviewFromFields: typeof buildShopifyApprovalPreviewFromFields;
  requireRouteAccess?: typeof requireRouteAccess;
}

export function createHandler(dependencies: GetShopifyApprovalPreviewDependencies = { buildShopifyApprovalPreviewFromFields }) {
  return async function getShopifyApprovalPreviewHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await (dependencies.requireRouteAccess ?? requireRouteAccess)(event);
      const body = requireJsonBody<GetShopifyApprovalPreviewBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
      if (!body.fields || typeof body.fields !== 'object') {
        return jsonError(400, toApiErrorBody('shopify', new Error('fields are required'), 'INVALID_SHOPIFY_APPROVAL_PREVIEW_REQUEST'), { origin });
      }

      return jsonOk(await dependencies.buildShopifyApprovalPreviewFromFields(body.fields), { origin });
    } catch (error) {
      logError('Failed to build Shopify approval preview', error);
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_APPROVAL_PREVIEW_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();