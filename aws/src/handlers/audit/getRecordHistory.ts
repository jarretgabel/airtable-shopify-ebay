import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, readIntegerQueryParam, requirePathParam } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';
import { getPostgresPool } from '../../db/pool.js';
import { resolveConfiguredSourceTable } from '../../providers/airtable/sources.js';
import { readAuditLog } from '../../store/auditLog.js';

const SOURCES = new Set([
  'approval-combined', 'used-gear-workflow', 'inventory-directory', 'users', 'shopify-vendors',
  'user-guide', 'approval-ebay', 'approval-shopify', 'workflow-image-roles',
]);

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { adminOnly: true });
    const source = requirePathParam(event, 'source', 'audit', 'MISSING_SOURCE');
    const recordId = requirePathParam(event, 'recordId', 'audit', 'MISSING_RECORD_ID');
    if (!SOURCES.has(source)) {
      throw new HttpError(400, 'Unsupported source', { service: 'audit', code: 'AUDIT_SOURCE_NOT_ALLOWED', retryable: false });
    }
    const { baseId, tableId } = resolveConfiguredSourceTable(source as Parameters<typeof resolveConfiguredSourceTable>[0]);
    const entries = await readAuditLog(getPostgresPool(), baseId, tableId, recordId, readIntegerQueryParam(event, 'limit', { defaultValue: 100, min: 1, max: 500, service: 'audit', code: 'AUDIT_LIMIT_INVALID' }));
    return jsonOk({ entries }, { origin });
  } catch (error) {
    logError('Failed to read record history', error, { source: event.pathParameters?.source || '' });
    return jsonError(getStatusCode(error), toApiErrorBody('audit', error, 'AUDIT_READ_FAILED'), { origin });
  }
}
