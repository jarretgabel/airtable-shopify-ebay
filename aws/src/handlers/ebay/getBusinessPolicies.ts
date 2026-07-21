import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getEbayBusinessPolicies } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const policies = await getEbayBusinessPolicies(marketplaceId);
    logInfo('Fetched eBay business policies', {
      marketplaceId: policies.marketplaceId,
      fulfillmentCount: policies.fulfillmentPolicies.length,
      paymentCount: policies.paymentPolicies.length,
      returnCount: policies.returnPolicies.length,
    });
    return jsonOk(policies, { origin });
  } catch (error) {
    logError('Failed to fetch eBay business policies', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_BUSINESS_POLICIES_FAILED'), { origin });
  }
}
