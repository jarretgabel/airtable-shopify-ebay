import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import {
  validateApprovalNormalizeRequestBody,
  type ApprovalNormalizeRequestBody,
  type ApprovalNormalizeTarget,
} from '../../shared/contracts/approval.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  normalizeApprovalFields,
} from '../../providers/approval/normalize.js';

interface NormalizeApprovalDependencies {
  normalizeApprovalFields: typeof normalizeApprovalFields;
  requireRouteAccess?: typeof requireRouteAccess;
}

async function requireTargetAccess(
  event: APIGatewayProxyEventV2,
  target: ApprovalNormalizeTarget,
  requireAccess: typeof requireRouteAccess,
): Promise<void> {
  if (target === 'shopify' || target === 'both') {
    await requireAccess(event, { anyPage: ['shopify-approval'] });
  }

  if (target === 'ebay' || target === 'both') {
    await requireAccess(event, { anyPage: ['approval'] });
  }
}

export function createHandler(dependencies: NormalizeApprovalDependencies = { normalizeApprovalFields }) {
  return async function normalizeApprovalHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const body = requireJsonBody<ApprovalNormalizeRequestBody>(event, 'approval', 'INVALID_APPROVAL_NORMALIZE_REQUEST_BODY');
      const validation = validateApprovalNormalizeRequestBody(body);
      if (!validation.ok) {
        return jsonError(
          400,
          toApiErrorBody('approval', new Error(validation.message), 'INVALID_APPROVAL_NORMALIZE_REQUEST'),
          { origin },
        );
      }

      const request = validation.value;

      await requireTargetAccess(event, request.target, dependencies.requireRouteAccess ?? requireRouteAccess);

      const result = await dependencies.normalizeApprovalFields({
        target: request.target,
        fields: request.fields,
        bodyPreview: request.bodyPreview,
        categoryPreview: request.categoryPreview,
      });

      logInfo('Normalized approval fields', {
        target: request.target,
        hasShopify: Boolean(result.shopify),
        hasEbay: Boolean(result.ebay),
      });
      return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to normalize approval fields', error);
      return jsonError(getStatusCode(error), toApiErrorBody('approval', error, 'APPROVAL_NORMALIZE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();