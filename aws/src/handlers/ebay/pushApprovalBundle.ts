import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { pushApprovalBundleToEbay, type EbayPublishSetup } from '../../providers/ebay/client.js';
import { buildEbayDraftPayloadBundleFromApprovalFields } from '../../providers/ebay/approvalDraft.js';
import { getConfiguredRecord, type AirtableConfiguredRecordsSource } from '../../providers/airtable/sources.js';

interface PushApprovalBundleBody {
  bundle?: {
    inventoryItem?: Record<string, unknown>;
    offer?: Record<string, unknown>;
  };
  publishSetup?: EbayPublishSetup;
  source?: AirtableConfiguredRecordsSource;
  recordId?: string;
}

interface PushApprovalBundleDependencies {
  pushApprovalBundleToEbay: typeof pushApprovalBundleToEbay;
  buildEbayDraftPayloadBundleFromApprovalFields: typeof buildEbayDraftPayloadBundleFromApprovalFields;
  getConfiguredRecord: typeof getConfiguredRecord;
  requireRouteAccess?: typeof requireRouteAccess;
}

export function createHandler(dependencies: PushApprovalBundleDependencies = {
  pushApprovalBundleToEbay,
  buildEbayDraftPayloadBundleFromApprovalFields,
  getConfiguredRecord,
}) {
  return async function pushApprovalBundleHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await (dependencies.requireRouteAccess ?? requireRouteAccess)(event);
      const body = requireJsonBody<PushApprovalBundleBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');

      const resolvedBundle = body.bundle?.inventoryItem && body.bundle?.offer
        ? body.bundle
        : body.source && body.recordId
          ? dependencies.buildEbayDraftPayloadBundleFromApprovalFields((await dependencies.getConfiguredRecord(body.source, body.recordId)).fields as Record<string, unknown>)
          : null;

      if (!resolvedBundle?.inventoryItem || !resolvedBundle?.offer) {
        return jsonError(400, toApiErrorBody('ebay', new Error('Provide bundle.inventoryItem and bundle.offer or source and recordId'), 'INVALID_EBAY_APPROVAL_BUNDLE'), { origin });
      }

      const result = await dependencies.pushApprovalBundleToEbay({
        inventoryItem: resolvedBundle.inventoryItem,
        offer: resolvedBundle.offer,
      }, body.publishSetup);
      logInfo('Pushed approval bundle to eBay', { sku: result.sku, offerId: result.offerId, listingId: result.listingId });
      return jsonOk(result, { origin });
    } catch (error) {
      logError('Failed to push approval bundle to eBay', error);
      return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_PUSH_APPROVAL_BUNDLE_FAILED'), { origin });
    }
  };
}

export const handler = createHandler();