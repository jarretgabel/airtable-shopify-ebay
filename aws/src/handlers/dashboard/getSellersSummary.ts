import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getSellersSummary } from '../../db/sellersSummary.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The sellers summary needs the Postgres database, which is not configured.', {
        service: 'dashboard',
        code: 'POSTGRES_NOT_CONFIGURED',
        retryable: false,
      });
    }
    const limit = Number(event.queryStringParameters?.limit ?? 10);
    return jsonOk(await getSellersSummary(getPostgresPool(), limit), { origin });
  } catch (error) {
    logError('Failed to load sellers summary', error);
    return jsonError(getStatusCode(error), toApiErrorBody('dashboard', error, 'SELLERS_SUMMARY_FAILED'), { origin });
  }
}
