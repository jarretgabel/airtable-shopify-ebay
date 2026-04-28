import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { confirmEmailChange } from '../../providers/auth/service.js';

interface ConfirmEmailChangeBody {
  token?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const body = requireJsonBody<ConfirmEmailChangeBody>(event, 'auth', 'INVALID_AUTH_EMAIL_CHANGE_CONFIRM_BODY');
    await confirmEmailChange(String(body.token || ''));
    logInfo('Confirmed email change');
    return jsonOk({ success: true, message: 'Email updated successfully.' });
  } catch (error) {
    logError('Failed to confirm email change', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_EMAIL_CHANGE_CONFIRM_FAILED'));
  }
}