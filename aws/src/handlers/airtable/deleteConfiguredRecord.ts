import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { deleteConfiguredRecord, type AirtableConfiguredWriteSource } from '../../providers/airtable/sources.js';

function validateWriteSource(value: string): AirtableConfiguredWriteSource {
  if (
    value === 'users'
    || value === 'inventory-directory'
    || value === 'approval-ebay'
    || value === 'approval-shopify'
    || value === 'approval-combined'
  ) {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable configured write source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const source = validateWriteSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    await deleteConfiguredRecord(source, recordId);
    logInfo('Deleted Airtable configured record', { source, recordId });
    return jsonOk({ deleted: true });
  } catch (error) {
    logError('Failed to delete Airtable configured record', error, {
      source: event.pathParameters?.source || '',
      recordId: event.pathParameters?.recordId || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_DELETE_RECORD_FAILED'));
  }
}