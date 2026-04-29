import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { createSampleListing, type EbayPublishSetup } from '../../providers/ebay/client.js';

interface CreateSampleListingBody {
  mode?: 'inventory' | 'trading' | 'trading-verify';
  publishSetup?: EbayPublishSetup;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const body = requireJsonBody<CreateSampleListingBody>(event, 'ebay', 'INVALID_EBAY_REQUEST_BODY');
    const mode = body.mode ?? 'inventory';
    const result = await createSampleListing(mode, body.publishSetup);
    logInfo('Created eBay sample listing payload', { mode, sku: result.sku, status: result.status });
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to create eBay sample listing', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_CREATE_SAMPLE_LISTING_FAILED'), { origin });
  }
}