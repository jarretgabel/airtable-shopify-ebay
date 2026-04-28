import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { resetPassword } from '../../providers/auth/service.js';

interface ResetPasswordBody {
  token?: string;
  password?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<ResetPasswordBody>(event, 'auth', 'INVALID_AUTH_PASSWORD_RESET_BODY');
    await resetPassword(String(body.token || ''), String(body.password || ''));
    logInfo('Reset password via auth token');
    return jsonOk({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    logError('Failed to reset password', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_PASSWORD_RESET_FAILED'));
  }
}