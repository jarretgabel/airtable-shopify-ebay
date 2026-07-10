import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { hasFullAccessRole } from '../../shared/appPages.js';
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

const SELF_SERVICE_USER_WRITE_FIELD_NAMES = new Set([
  'User Id',
  'Name',
  'Email',
  'Role',
  'MustChangePassword',
  'Allowed Pages',
  'Notifications',
  'Updated At',
]);

function validateWriteSource(value: string): AirtableConfiguredWriteSource {
  if (
    value === 'users'
    || value === 'user-guide'
    || value === 'inventory-directory'
    || value === 'used-gear-workflow'
    || value === 'approval-ebay'
    || value === 'approval-shopify'
    || value === 'approval-combined'
    || value === 'shopify-vendors'
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

function readStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const firstString = value.find((entry): entry is string => typeof entry === 'string');
    return firstString?.trim() ?? '';
  }

  return '';
}

function readBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  return null;
}

function normalizeAllowedPagesValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(',');
  }

  return readStringValue(value);
}

function assertSelfUserUpdateAllowed(
  user: Awaited<ReturnType<typeof requireRouteAccess>>,
  recordId: string,
  fields: Record<string, unknown>,
): void {
  if (user.airtableRecordId !== recordId) {
    throw new HttpError(403, 'You can only update your own account settings.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  for (const fieldName of Object.keys(fields)) {
    if (!SELF_SERVICE_USER_WRITE_FIELD_NAMES.has(fieldName)) {
      throw new HttpError(403, 'Only your own notification settings can be updated from this account.', {
        service: 'auth',
        code: 'AUTH_FORBIDDEN',
        retryable: false,
      });
    }
  }

  const userId = readStringValue(fields['User Id']);
  if (userId && userId !== user.userId) {
    throw new HttpError(403, 'Only your own account settings can be updated from this session.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  const name = readStringValue(fields.Name);
  if (name && name !== user.name) {
    throw new HttpError(403, 'Account identity changes must use the dedicated account settings flows.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  const email = readStringValue(fields.Email).toLowerCase();
  if (email && email !== user.email.toLowerCase()) {
    throw new HttpError(403, 'Email changes must use the dedicated account settings flows.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  const role = readStringValue(fields.Role).toLowerCase();
  if (role && role !== user.role) {
    throw new HttpError(403, 'Role changes require admin or owner access.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  const mustChangePassword = readBooleanValue(fields.MustChangePassword);
  if (mustChangePassword !== null && mustChangePassword !== user.mustChangePassword) {
    throw new HttpError(403, 'Password state changes must use the dedicated account settings flows.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }

  const allowedPages = normalizeAllowedPagesValue(fields['Allowed Pages']);
  if (allowedPages && allowedPages !== user.allowedPages.join(',')) {
    throw new HttpError(403, 'Access changes require admin or owner access.', {
      service: 'auth',
      code: 'AUTH_FORBIDDEN',
      retryable: false,
    });
  }
}

interface UpsertConfiguredRecordDependencies {
  requireRouteAccess?: typeof requireRouteAccess;
  createConfiguredRecord?: typeof createConfiguredRecord;
  updateConfiguredRecord?: typeof updateConfiguredRecord;
}

export function createCreateHandler(dependencies: UpsertConfiguredRecordDependencies = {}) {
  const requireAccess = dependencies.requireRouteAccess ?? requireRouteAccess;
  const createRecord = dependencies.createConfiguredRecord ?? createConfiguredRecord;

  return async function createConfiguredRecordHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      await requireAccess(event);
      const source = validateWriteSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
      const body = requireJsonBody<AirtableWriteBody>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');
      const record = await createRecord(source, validateFields(body.fields), {
        typecast: body.typecast === true,
      });
      logInfo('Created Airtable configured record', { source, recordId: record.id });
      return jsonOk(record, { origin });
    } catch (error) {
      logError('Failed to create Airtable configured record', error, { source: event.pathParameters?.source || '' });
      return jsonError(getStatusCode(error), toApiErrorBody('airtable', error, 'AIRTABLE_CREATE_RECORD_FAILED'), { origin });
    }
  };
}

export function createUpdateHandler(dependencies: UpsertConfiguredRecordDependencies = {}) {
  const requireAccess = dependencies.requireRouteAccess ?? requireRouteAccess;
  const updateRecord = dependencies.updateConfiguredRecord ?? updateConfiguredRecord;

  return async function updateConfiguredRecordHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    const origin = getRequestOrigin(event);
    try {
      const source = validateWriteSource(requirePathParam(event, 'source', 'airtable', 'MISSING_SOURCE'));
      const recordId = requirePathParam(event, 'recordId', 'airtable', 'MISSING_RECORD_ID');
      const body = requireJsonBody<AirtableWriteBody>(event, 'airtable', 'INVALID_AIRTABLE_REQUEST_BODY');
      const fields = validateFields(body.fields);
      const user = source === 'users'
        ? await requireAccess(event, {})
        : await requireAccess(event);

      if (source === 'users' && !hasFullAccessRole(user.role)) {
        assertSelfUserUpdateAllowed(user, recordId, fields);
      }

      const record = await updateRecord(source, recordId, fields, {
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
  };
}

export async function createHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return createCreateHandler()(event);
}

export async function updateHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  return createUpdateHandler()(event);
}