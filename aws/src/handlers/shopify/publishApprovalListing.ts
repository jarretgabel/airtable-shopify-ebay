import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { publishApprovalListingToShopify } from '../../providers/shopify/approvalPublish.js';
import type { AirtableConfiguredRecordsSource } from '../../providers/airtable/sources.js';

interface PublishApprovalListingBody {
  source?: AirtableConfiguredRecordsSource;
  recordId?: string;
  productIdFieldName?: string;
}

interface PublishApprovalListingDependencies {
  publishApprovalListingToShopify: typeof publishApprovalListingToShopify;
  requireRouteAccess?: typeof requireRouteAccess;
}

export function createHandler(dependencies: PublishApprovalListingDependencies = { publishApprovalListingToShopify }) {
  return async function publishApprovalListingHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await (dependencies.requireRouteAccess ?? requireRouteAccess)(event);
      const body = requireJsonBody<PublishApprovalListingBody>(event, 'shopify', 'INVALID_SHOPIFY_REQUEST_BODY');
      if (!body.source || !body.recordId) {
        return jsonError(400, toApiErrorBody('shopify', new Error('source and recordId are required'), 'INVALID_SHOPIFY_APPROVAL_PUBLISH_REQUEST'), { origin });
      }

      const result = await dependencies.publishApprovalListingToShopify({
        source: body.source,
        recordId: body.recordId,
        productIdFieldName: body.productIdFieldName,
      });
      logInfo('Published Shopify approval listing', { source: body.source, recordId: body.recordId, productId: result.productId, mode: result.mode });
      return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to publish Shopify approval listing', error);
      return jsonError(getStatusCode(error), toApiErrorBody('shopify', error, 'SHOPIFY_APPROVAL_PUBLISH_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();