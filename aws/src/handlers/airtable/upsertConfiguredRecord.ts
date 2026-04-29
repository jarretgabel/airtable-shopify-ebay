import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import {
  createConfiguredRecord,
  updateConfiguredRecord,
  type AirtableConfiguredWriteSource,
} from '../../providers/airtable/sources.js';

interface AirtableWriteBody {
  fields?: Record<string, unknown>;
  typecast?: boolean;
}

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

function validateFields(fields: unknown): Record<string, unknown> {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new HttpError(400, 'fields must be an object', {
      service: 'airtable',
      code: 'INVALID_AIRTABLE_FIELDS',
      retryable: false,
    });
  }

  return fields as Record<string, unknown>;
}

export async function createHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateWriteSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const body = requireJsonBody<AirtableWriteBody>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');
    const record = await createConfiguredRecord(source, validateFields(body.fields), {
      typecast: body.typecast === true,
    });
    logInfo('Created Airtable configured record', { source, recordId: record.id });
    return jsonOk(record, { origin });
  } catch (error) {
    logError('Failed to create Airtable configured record', error, { source: event.pathParameters?.source || '' });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_CREATE_RECORD_FAILED'), { origin });
  }
}

export async function updateHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    const source = validateWriteSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
    const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
    const body = requireJsonBody<AirtableWriteBody>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');
    const record = await updateConfiguredRecord(source, recordId, validateFields(body.fields), {
      typecast: body.typecast === true,
    });
    logInfo('Updated Airtable configured record', { source, recordId: record.id });
    return jsonOk(record, { origin });
  } catch (error) {
    logError('Failed to update Airtable configured record', error, {
      source: event.pathParameters?.source || '',
      recordId: event.pathParameters?.recordId || '',
    });
    return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_UPDATE_RECORD_FAILED'), { origin });
  }
}