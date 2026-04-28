import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireQueryParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { getConfiguredFieldMetadata, type AirtableConfiguredMetadataSource } from '../../providers/airtable/sources.js';

function validateSource(value: string): AirtableConfiguredMetadataSource {
  if (value === 'inventory-directory') {
    return value;
  }

  throw new HttpError(400, 'Unsupported Airtable metadata source', {
    service: 'airtable',
    code: 'AIRTABLE_SOURCE_NOT_ALLOWED',
    retryable: false,
  });
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const source = validateSource(requireQueryParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const fields = await getConfiguredFieldMetadata(source);
    logInfo('Fetched Airtable configured metadata', { source, count: fields.length });
    return jsonOk(fields);
  } catch (error) {
    logError('Failed to fetch Airtable configured metadata', error, { source: event.queryStringParameters?.source || '' });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_GET_CONFIGURED_METADATA_FAILED'));
  }
}