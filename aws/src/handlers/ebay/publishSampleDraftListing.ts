import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { publishSampleDraftListing, type EbayPublishSetup } from '../../providers/ebay/client.js';

interface PublishSampleDraftListingBody {
  publishSetup?: EbayPublishSetup;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<PublishSampleDraftListingBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const result = await publishSampleDraftListing(body.publishSetup);
    logInfo('Published eBay sample draft listing', { sku: result.sku, offerId: result.offerId, listingId: result.listingId });
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to publish eBay sample draft listing', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_PUBLISH_SAMPLE_DRAFT_FAILED'), { origin });
  }
}