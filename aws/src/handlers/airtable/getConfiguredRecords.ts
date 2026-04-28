import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { getOptionalQueryParam, jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getConfiguredRecords, type AirtableConfiguredRecordsSource } from '../../providers/airtable/sources.js';

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
  try {
    const source = validateSource(requireQueryParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const fields = getOptionalQueryParam(event, 'fields')
      ?.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    const records = await getConfiguredRecords(source, { fields });
    logInfo('Fetched Airtable configured records', { source, count: records.length });
    return jsonOk(records);
  } catch (error) {
    logError('Failed to fetch Airtable configured records', error, {
      source: event.queryStringParameters?.source || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_RECORDS_FAILED'));
  }
}