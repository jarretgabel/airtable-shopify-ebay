import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getRuntimeConfig } from '../../providers/ebay/client.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const config = getRuntimeConfig();
    logInfo('Fetched eBay runtime config', {
      environment: config.environment,
      hasRequiredPublishSetup: config.hasRequiredPublishSetup,
    });
    return jsonOk(config, { origin });
  } catch (error) {
    logError('Failed to fetch eBay runtime config', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_RUNTIME_CONFIG_FAILED'), { origin });
  }
}