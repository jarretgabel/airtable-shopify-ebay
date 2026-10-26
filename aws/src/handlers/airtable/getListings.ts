import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getListings } from '../../providers/airtable/client.js';
import { getConfiguredRecords } from '../../store/index.js';
import { resolveDataBackend } from '../../store/backend.js';
import { resolveConfiguredSourceTable } from '../../providers/airtable/sources.js';
import { validateListingsRequest } from '../../providers/airtable/validation.js';

const STORE_SOURCE_CANDIDATES = ['inventory-directory', 'approval-ebay'] as const;

/** The configured source that reads this table from the store, or undefined while it is still on Airtable. */
export function storeSourceForTable(tableName: string): (typeof STORE_SOURCE_CANDIDATES)[number] | undefined {
  return STORE_SOURCE_CANDIDATES.find((source) => resolveDataBackend(source) !== 'airtable'
    && resolveConfiguredSourceTable(source).tableId === tableName);
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const tableName = requireQueryParam(event, 'tableName', 'airtable', 'MISSING_TABLE_NAME');
    const view = getOptionalQueryParam(event, 'view');
    const request = validateListingsRequest({ tableName, view });
    // Once a source on this table is off Airtable, serve the whole table from the store (the Airtable view is not
    // mirrored; on pg-test the view and the table hold the same 411 records).
    const storeSource = storeSourceForTable(request.tableName);
    const records = storeSource
      ? await getConfiguredRecords(storeSource)
      : await getListings(request.tableName, request.view);
    logInfo('Fetched Airtable listings', {
      tableName: request.tableName,
      view: request.view || '',
      count: records.length,
      backend: storeSource ? 'store' : 'airtable',
    });
    return jsonOk(records, { origin });
  } catch (error) {
    logError('Failed to fetch Airtable listings', error, {
      tableName: event.queryStringParameters?.tableName || '',
      view: event.queryStringParameters?.view || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_LISTINGS_FAILED'), { origin });
  }
}