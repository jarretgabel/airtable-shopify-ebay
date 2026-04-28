import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getEbayPackageTypes } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const marketplaceId = getOptionalQueryParam(event, 'marketplaceId') ?? 'EBAY_US';
    const packageTypes = await getEbayPackageTypes(marketplaceId);
    logInfo('Fetched eBay package types', { count: packageTypes.length, marketplaceId });
    return jsonOk(packageTypes);
  } catch (error) {
    logError('Failed to fetch eBay package types', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_PACKAGE_TYPES_FAILED'));
  }
}