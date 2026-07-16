import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import {
  validateApprovalTakeDownRequestBody,
  type ApprovalTakeDownExecutionResult,
  type ApprovalTakeDownRequestBody,
} from '../../shared/contracts/approval.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getConfiguredRecord } from '../../providers/airtable/sources.js';
import {
  closeEbayListingWhenSoldOnShopify,
  closeShopifyProductWhenSoldOnEbay,
} from '../../services/crossChannelClose.js';

interface TakeDownApprovalDependencies {
  getConfiguredRecord: typeof getConfiguredRecord;
  closeEbayListingWhenSoldOnShopify: typeof closeEbayListingWhenSoldOnShopify;
  closeShopifyProductWhenSoldOnEbay: typeof closeShopifyProductWhenSoldOnEbay;
  requireRouteAccess?: typeof requireRouteAccess;
}

export function createHandler(dependencies: TakeDownApprovalDependencies = {
  getConfiguredRecord,
  closeEbayListingWhenSoldOnShopify,
  closeShopifyProductWhenSoldOnEbay,
}) {
  return async function takeDownApprovalHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);

    try {
      const body = requireJsonBody<ApprovalTakeDownRequestBody>(event, 'approval', 'INVALID_APPROVAL_TAKEDOWN_REQUEST_BODY');
      const validation = validateApprovalTakeDownRequestBody(body);
      if (!validation.ok) {
        return jsonError(
          400,
          toApiErrorBody('approval', new Error(validation.message), 'INVALID_APPROVAL_TAKEDOWN_REQUEST'),
          { origin },
        );
      }

      await (dependencies.requireRouteAccess ?? requireRouteAccess)(event, { anyPage: ['listings', 'post-publish'] });

      const { target, recordId } = validation.value;
      const record = await dependencies.getConfiguredRecord('used-gear-workflow', recordId);
      const fields = record.fields as Record<string, unknown>;
      const results: ApprovalTakeDownExecutionResult['results'] = [];

      if (target === 'shopify' || target === 'both') {
        const shopifyResult = await dependencies.closeShopifyProductWhenSoldOnEbay(recordId, fields, {
          forceShopifyDelete: true,
        });
        results.push({
          channel: 'shopify',
          success: shopifyResult.success,
          message: shopifyResult.message,
          closedAt: shopifyResult.closedAt,
        });
      }

      if (target === 'ebay' || target === 'both') {
        const ebayResult = await dependencies.closeEbayListingWhenSoldOnShopify(recordId, fields);
        results.push({
          channel: 'ebay',
          success: ebayResult.success,
          message: ebayResult.message,
          closedAt: ebayResult.closedAt,
        });
      }

      const success = results.every((result) => result.success);
      const response: ApprovalTakeDownExecutionResult = {
        target,
        recordId,
        success,
        results,
      };

      logInfo('Executed approval listing takedown', {
        target,
        recordId,
        success,
        results,
      });

      return jsonOk(response, { origin });
    } catch (error) {
      logError('Failed to execute approval listing takedown', error);
      return jsonError(getStatusCode(error), toApiErrorBody('approval', error, 'APPROVAL_TAKEDOWN_EXECUTION_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();
