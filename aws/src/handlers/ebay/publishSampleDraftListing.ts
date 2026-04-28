import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { publishSampleDraftListing, type EbayPublishSetup } from '../../providers/ebay/client.js';

interface PublishSampleDraftListingBody {
  publishSetup?: EbayPublishSetup;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<PublishSampleDraftListingBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const result = await publishSampleDraftListing(body.publishSetup);
    logInfo('Published eBay sample draft listing', { sku: result.sku, offerId: result.offerId, listingId: result.listingId });
    return jsonOk(result);
  } catch (error) {
    logError('Failed to publish eBay sample draft listing', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_PUBLISH_SAMPLE_DRAFT_FAILED'));
  }
}