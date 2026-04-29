import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';
import { buildEbayApprovalPreviewFromFields } from '../../providers/ebay/approvalPreview.js';

interface GetEbayApprovalPreviewBody {
  fields?: Record<string, unknown>;
  bodyPreview?: {
    templateHtml: string;
    title: string;
    description: string;
    keyFeatures: string;
    testingNotes?: string;
    fieldName?: string;
  };
}

interface GetEbayApprovalPreviewDependencies {
  buildEbayApprovalPreviewFromFields: typeof buildEbayApprovalPreviewFromFields;
  requireRouteAccess?: typeof requireRouteAccess;
}

export function createHandler(dependencies: GetEbayApprovalPreviewDependencies = { buildEbayApprovalPreviewFromFields }) {
  return async function getEbayApprovalPreviewHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await (dependencies.requireRouteAccess ?? requireRouteAccess)(event);
      const body = requireJsonBody<GetEbayApprovalPreviewBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
      if (!body.fields || typeof body.fields !== 'object') {
        return jsonError(400, toApiErrorBody('ebay', new Error('fields are required'), 'INVALID_EBAY_APPROVAL_PREVIEW_REQUEST'), { origin });
      }

      return jsonOk(dependencies.buildEbayApprovalPreviewFromFields(body.fields, body.bodyPreview), { origin });
    } catch (error) {
      logError('Failed to build eBay approval preview', error);
      return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_APPROVAL_PREVIEW_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();