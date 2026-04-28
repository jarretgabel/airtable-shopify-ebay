import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { pushApprovalBundleToEbay, type EbayPublishSetup } from '../../providers/ebay/client.js';

interface PushApprovalBundleBody {
  bundle?: {
    inventoryItem?: Record<string, unknown>;
    offer?: Record<string, unknown>;
  };
  publishSetup?: EbayPublishSetup;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<PushApprovalBundleBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');

    if (!body.bundle?.inventoryItem || !body.bundle?.offer) {
      return jsonError(400, toApiErrorBody('ebay', new Error('bundle.inventoryItem and bundle.offer are required'), 'INVALID_EBAY_APPROVAL_BUNDLE'));
    }

    const result = await pushApprovalBundleToEbay({
      inventoryItem: body.bundle.inventoryItem,
      offer: body.bundle.offer,
    }, body.publishSetup);
    logInfo('Pushed approval bundle to eBay', { sku: result.sku, offerId: result.offerId, listingId: result.listingId });
    return jsonOk(result);
  } catch (error) {
    logError('Failed to push approval bundle to eBay', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_PUSH_APPROVAL_BUNDLE_FAILED'));
  }
}