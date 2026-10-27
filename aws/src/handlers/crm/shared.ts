import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess, type AuthenticatedUser } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getStatusCode, HttpError, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody, requirePathParam } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVICE = 'crm';

export function badRequest(message: string, code: string): HttpError {
  return new HttpError(400, message, { service: SERVICE, code, retryable: false });
}

export function notFound(what: string): HttpError {
  return new HttpError(404, `${what} not found`, { service: SERVICE, code: 'CRM_NOT_FOUND', retryable: false });
}

export function requireUuidParam(event: APIGatewayProxyEventV2, name: string): string {
  const value = requirePathParam(event, name, SERVICE, 'CRM_MISSING_PARAM');
  if (!UUID.test(value)) throw badRequest(`${name} is not valid`, 'CRM_INVALID_ID');
  return value;
}

export function requireBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  const body = requireJsonBody<unknown>(event, SERVICE, 'CRM_INVALID_BODY');
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Request body must be an object', 'CRM_INVALID_BODY');
  return body as Record<string, unknown>;
}

export function requireText(value: unknown, label: string, maxLength = 2000): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw badRequest(`${label} is required`, 'CRM_INVALID_BODY');
  if (trimmed.length > maxLength) throw badRequest(`${label} is too long`, 'CRM_INVALID_BODY');
  return trimmed;
}

/** Full-access roles only (the /api/dashboard/ route rule); `run` receives the pool and the signed-in user. */
export function crmHandler(
  operation: string,
  run: (event: APIGatewayProxyEventV2, pool: ReturnType<typeof getPostgresPool>, user: AuthenticatedUser) => Promise<unknown>,
): (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2> {
  return async (event) => {
    const origin = getRequestOrigin(event);
    try {
      const user = await requireRouteAccess(event);
      if (!process.env.DATABASE_URL?.trim()) {
        throw new HttpError(503, 'Customer tracking needs the Postgres database, which is not configured.', { service: SERVICE, code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
      }
      return jsonOk(await run(event, getPostgresPool(), user), { origin });
    } catch (error) {
      logError(`Failed to ${operation}`, error);
      return jsonError(getStatusCode(error), toApiErrorBody(SERVICE, error, 'CRM_FAILED'), { origin });
    }
  };
}
