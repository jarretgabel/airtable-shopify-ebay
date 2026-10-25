import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getSellerHistory } from '../../db/sellerHistory.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event);
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'The seller history needs the Postgres database, which is not configured.', {
        service: 'dashboard',
        code: 'POSTGRES_NOT_CONFIGURED',
        retryable: false,
      });
    }
    const email = event.queryStringParameters?.email?.trim() ?? '';
    if (!email) {
      throw new HttpError(400, 'The email query parameter is required.', { service: 'dashboard', code: 'SELLER_EMAIL_REQUIRED', retryable: false });
    }
    const history = await getSellerHistory(getPostgresPool(), email);
    if (!history) {
      throw new HttpError(404, 'No contact found for that email.', { service: 'dashboard', code: 'SELLER_NOT_FOUND', retryable: false });
    }
    return jsonOk(history, { origin });
  } catch (error) {
    logError('Failed to load seller history', error);
    return jsonError(getStatusCode(error), toApiErrorBody('dashboard', error, 'SELLER_HISTORY_FAILED'), { origin });
  }
}
