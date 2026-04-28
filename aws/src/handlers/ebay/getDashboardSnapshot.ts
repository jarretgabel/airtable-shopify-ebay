import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getDashboardSnapshot } from '../../providers/ebay/client.js';

export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const snapshot = await getDashboardSnapshot();
    logInfo('Fetched eBay dashboard snapshot', {
      inventoryCount: snapshot.inventoryItems.length,
      offerCount: snapshot.offers.length,
      total: snapshot.total,
    });
    return jsonOk(snapshot);
  } catch (error) {
    logError('Failed to fetch eBay dashboard snapshot', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_DASHBOARD_SNAPSHOT_FAILED'));
  }
}