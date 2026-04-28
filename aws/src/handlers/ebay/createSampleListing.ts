import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { createSampleListing, type EbayPublishSetup } from '../../providers/ebay/client.js';

interface CreateSampleListingBody {
  mode?: 'inventory' | 'trading' | 'trading-verify';
  publishSetup?: EbayPublishSetup;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<CreateSampleListingBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const mode = body.mode ?? 'inventory';
    const result = await createSampleListing(mode, body.publishSetup);
    logInfo('Created eBay sample listing payload', { mode, sku: result.sku, status: result.status });
    return jsonOk(result);
  } catch (error) {
    logError('Failed to create eBay sample listing', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_CREATE_SAMPLE_LISTING_FAILED'));
  }
}