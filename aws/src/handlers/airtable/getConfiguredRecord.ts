import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getConfiguredRecord, type AirtableConfiguredRecordsSource } from '../../providers/airtable/sources.js';

function validateSource(value: string): AirtableConfiguredRecordsSource {
  if (
    value === 'users'
    || value === 'inventory-directory'
    || value === 'approval-ebay'
    || value === 'approval-shopify'
    || value === 'approval-combined'
  ) {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable configured source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    const record = await getConfiguredRecord(source, recordId);
    logInfo('Fetched Airtable configured record', { source, recordId: record.id });
    return jsonOk(record, { origin });
  } catch (error) {
    logError('Failed to fetch Airtable configured record', error, {
      source: event.pathParameters?.source || '',
      recordId: event.pathParameters?.recordId || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_RECORD_FAILED'), { origin });
  }
}