import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getListings } from '../../providers/airtable/client.js';
import { validateListingsRequest } from '../../providers/airtable/validation.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const tableName = requireQueryParam(event, 'tableName', 'airtable', 'MISSING_TABLE_NAME');
    const view = getOptionalQueryParam(event, 'view');
    const request = validateListingsRequest({ tableName, view });
    const records = await getListings(request.tableName, request.view);
    logInfo('Fetched Airtable listings', {
      tableName: request.tableName,
      view: request.view || '',
      count: records.length,
    });
    return jsonOk(records);
  } catch (error) {
    logError('Failed to fetch Airtable listings', error, {
      tableName: event.queryStringParameters?.tableName || '',
      view: event.queryStringParameters?.view || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_LISTINGS_FAILED'));
  }
}