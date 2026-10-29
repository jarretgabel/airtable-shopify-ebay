import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { FINANCE_ROLES } from './getFinance.js';
import { getPostgresPool } from '../../db/pool.js';
import { getBuyersSummary } from '../../db/buyers.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getOptionalQueryParam, getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { roles: FINANCE_ROLES });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'Buyers need the Postgres database, which is not configured.', {
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
    return jsonOk(await getBuyersSummary(getPostgresPool(), { search: getOptionalQueryParam(event, 'search'), from, to }), { origin });
  } catch (error) {
    logError('Failed to load buyers', error);
    return jsonError(getStatusCode(error), toApiErrorBody('dashboard', error, 'BUYERS_FAILED'), { origin });
  }
}
