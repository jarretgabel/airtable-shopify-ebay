import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getListings } from '../../providers/airtable/client.js';
import { getPostgresPool } from '../../db/pool.js';
import { resolveDataBackend } from '../../store/backend.js';
import { createPostgresListingStore } from '../../store/postgresListingStore.js';
import { validateListingsRequest } from '../../providers/airtable/validation.js';

/** Postgres mode is signalled by the directory sources being off Airtable. */
export function servedFromPostgres(): boolean {
  return (['inventory-directory', 'approval-ebay'] as const).some((source) => resolveDataBackend(source) !== 'airtable');
}

// This table has no source of its own: Postgres holds a one-time backfilled copy that nothing writes to, and the
// Airtable view is not mirrored, so the whole table is returned.
function readBackfilledTable(tableName: string) {
  const baseId = process.env.AIRTABLE_BASE_ID?.trim() || '';
  const store = createPostgresListingStore({ pool: getPostgresPool(), resolveTable: () => ({ baseId, tableId: tableName }) });
  return store.getRecords('inventory-directory');
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const tableName = requireQueryParam(event, 'tableName', 'airtable', 'MISSING_TABLE_NAME');
    const view = getOptionalQueryParam(event, 'view');
    const request = validateListingsRequest({ tableName, view });
    const fromPostgres = servedFromPostgres();
    const records = fromPostgres
      ? await readBackfilledTable(request.tableName)
      : await getListings(request.tableName, request.view);
    logInfo('Fetched Airtable listings', {
      tableName: request.tableName,
      view: request.view || '',
      count: records.length,
      backend: fromPostgres ? 'postgres' : 'airtable',
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