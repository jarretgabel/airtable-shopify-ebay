import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireRouteAccess } from '../../shared/access.js';
import { getPostgresPool } from '../../db/pool.js';
import { getAssistantInsights, readCostRates } from '../../db/assistantInsights.js';
import { HttpError, getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError } from '../../shared/logging.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    await requireRouteAccess(event, { roles: ['owner', 'developer'] });
    if (!process.env.DATABASE_URL?.trim()) {
      throw new HttpError(503, 'Assistant usage needs the Postgres database, which is not configured.', { service: 'ai', code: 'POSTGRES_NOT_CONFIGURED', retryable: false });
    }
    return jsonOk(await getAssistantInsights(getPostgresPool(), readCostRates()), { origin });
  } catch (error) {
    logError('Failed to load assistant insights', error);
    return jsonError(getStatusCode(error), toApiErrorBody('ai', error, 'AI_ASSISTANT_INSIGHTS_FAILED'), { origin });
  }
}
