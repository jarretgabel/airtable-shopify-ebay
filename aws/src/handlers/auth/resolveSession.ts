import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { buildCsrfToken } from '../../shared/csrf.js';
import { getRequestOrigin, jsonError, jsonOk } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { resolveSession } from '../../providers/auth/service.js';
import { readSessionTokenFromEvent } from './sessionCookie.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  const sessionToken = readSessionTokenFromEvent(event) || '';
  try {
    const result = await resolveSession(sessionToken);
    logInfo('Resolved auth session', { userId: result.userId });
    return jsonOk({ ...result, csrfToken: buildCsrfToken(sessionToken) }, { origin });
  } catch (error) {
    logError('Failed to resolve auth session', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_SESSION_FAILED'), { origin });
  }
}