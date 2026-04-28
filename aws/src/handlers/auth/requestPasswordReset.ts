import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { requestPasswordReset } from '../../providers/auth/service.js';

interface RequestPasswordResetBody {
  email?: string;
  origin?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<RequestPasswordResetBody>(event, 'auth', 'INVALID_AUTH_PASSWORD_RESET_REQUEST_BODY');
    const result = await requestPasswordReset(String(body.email || ''), String(body.origin || ''));
    logInfo('Requested password reset', { email: String(body.email || '').trim().toLowerCase() });
    return jsonOk(result);
  } catch (error) {
    logError('Failed to request password reset', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_PASSWORD_RESET_REQUEST_FAILED'));
  }
}