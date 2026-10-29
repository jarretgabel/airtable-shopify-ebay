import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getFinanceSummary } from '../../db/finance.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

export const FINANCE_ROLES = ['admin', 'owner', 'developer'];

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { roles: FINANCE_ROLES });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'Cost and earnings need the Postgres database, which is not configured.', {
        service: 'dashboard',
        code: 'POSTGRES_NOT_CONFIGURED',
        retryable: false,
      });
    }
    const from = getOptionalQueryParam(event, 'from');
    const to = getOptionalQueryParam(event, 'to');
    for (const value of [from, to]) {
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new HttpError(400, 'from and to must be YYYY-MM-DD dates.', { service: 'dashboard', code: 'INVALID_DATE', retryable: false });
      }
    }
    return jsonOk(await getFinanceSummary(getPostgresPool(), { from, to }), { origin });
  } catch (error) {
    logError('Failed to load cost and earnings', error);
    return jsonError(getStatusCode(error), toApiErrorBody('dashboard', error, 'FINANCE_FAILED'), { origin });
  }
}
