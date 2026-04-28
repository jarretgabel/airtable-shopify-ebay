import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, readIntegerQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getInventoryItems } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const limit = readIntegerQueryParam(event, 'limit', {
      defaultValue: 25,
      min: 1,
      max: 200,
      service: 'ebay',
      code: 'INVALID_LIMIT',
    });

    const page = await getInventoryItems(limit);
    logInfo('Fetched eBay inventory items', { count: page.inventoryItems.length, total: page.total, limit });
    return jsonOk(page);
  } catch (error) {
    logError('Failed to fetch eBay inventory items', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_GET_INVENTORY_ITEMS_FAILED'));
  }
}