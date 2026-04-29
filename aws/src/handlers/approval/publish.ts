import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import {
  validateApprovalPublishRequestBody,
  type ApprovalPublishRequestBody,
  type ApprovalPublishTarget,
} from '../../shared/contracts/approval.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  executeApprovalPublish,
} from '../../providers/approval/publish.js';

interface PublishApprovalDependencies {
  executeApprovalPublish: typeof executeApprovalPublish;
  requireRouteAccess?: typeof requireRouteAccess;
}

async function requireTargetAccess(
  event: APIGatewayProxyEventV2,
  target: ApprovalPublishTarget,
  requireAccess: typeof requireRouteAccess,
): Promise<void> {
  if (target === 'shopify' || target === 'both') {
    await requireAccess(event, { anyPage: ['shopify-approval'] });
  }

  if (target === 'ebay' || target === 'both') {
    await requireAccess(event, { anyPage: ['approval'] });
  }
}

export function createHandler(dependencies: PublishApprovalDependencies = { executeApprovalPublish }) {
  return async function publishApprovalHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const body = requireJsonBody<ApprovalPublishRequestBody>(event, 'approval', 'INVALID_APPROVAL_PUBLISH_REQUEST_BODY');
      const validation = validateApprovalPublishRequestBody(body);
      if (!validation.ok) {
        return jsonError(
          400,
          toApiErrorBody('approval', new Error(validation.message), 'INVALID_APPROVAL_PUBLISH_REQUEST'),
          { origin },
        );
      }

      const request = validation.value;

      await requireTargetAccess(event, request.target, dependencies.requireRouteAccess ?? requireRouteAccess);

      const result = await dependencies.executeApprovalPublish({
        target: request.target,
        source: request.source,
        recordId: request.recordId,
        productIdFieldName: request.productIdFieldName,
        publishSetup: request.publishSetup,
        fields: request.fields,
      });

      logInfo('Executed approval publish orchestration', {
        target: request.target,
        source: request.source,
        recordId: request.recordId,
        shopifyProductId: result.shopify?.productId,
        ebayOfferId: result.ebay?.offerId,
        failures: result.failures.length,
      });
      return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to execute approval publish orchestration', error);
      return jsonError(getStatusCode(error), toApiErrorBody('approval', error, 'APPROVAL_PUBLISH_EXECUTION_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();