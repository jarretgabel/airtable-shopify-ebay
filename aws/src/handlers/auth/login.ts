import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { login } from '../../providers/auth/service.js';
import { buildSessionCookie } from './sessionCookie.js';

interface LoginBody {
  email?: string;
  password?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const body = requireJsonBody<LoginBody>(event, 'auth', 'INVALID_AUTH_LOGIN_BODY');
    const result = await login(String(body.email || ''), String(body.password || ''));
    logInfo('Authenticated user session', { userId: result.userId });
    return jsonOk({ userId: result.userId, mustChangePassword: result.mustChangePassword }, {
      origin,
      cookies: [buildSessionCookie(result.sessionToken)],
    });
  } catch (error) {
    logError('Failed to authenticate user session', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_LOGIN_FAILED'), { origin });
  }
}