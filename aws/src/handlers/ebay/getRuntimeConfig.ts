import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getRuntimeConfig } from '../../providers/ebay/client.js';

export async function handler(_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const config = getRuntimeConfig();
    logInfo('Fetched eBay runtime config', {
      environment: config.environment,
      hasRequiredPublishSetup: config.hasRequiredPublishSetup,
    });
    return jsonOk(config);
  } catch (error) {
    logError('Failed to fetch eBay runtime config', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ebay', error, 'EBAY_RUNTIME_CONFIG_FAILED'));
  }
}