import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { requireSessionCsrf } from '../../shared/csrf.js';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { updatePassword } from '../../providers/auth/service.js';
import { readSessionTokenFromEvent } from './sessionCookie.js';

interface UpdatePasswordBody {
  currentPassword?: string;
  nextPassword?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  const sessionToken = readSessionTokenFromEvent(event) || '';
  try {
    requireSessionCsrf(event, sessionToken);
    const body = requireJsonBody<UpdatePasswordBody>(event, 'auth', 'INVALID_AUTH_UPDATE_PASSWORD_BODY');
    const result = await updatePassword(sessionToken, body.currentPassword, String(body.nextPassword || ''));
    logInfo('Updated account password');
    return jsonOk({ success: true, message: 'Password updated successfully.', ...result }, { origin });
  } catch (error) {
    logError('Failed to update account password', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_UPDATE_PASSWORD_FAILED'), { origin });
  }
}