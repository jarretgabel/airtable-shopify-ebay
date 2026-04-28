import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getStatusCode, toApiErrorBody } from '../../shared/errors.js';
import { getRequestOrigin, jsonError, jsonOk, requireJsonBody } from '../../shared/http.js';
import { logError, logInfo } from '../../shared/logging.js';
import { requestEmailChange } from '../../providers/auth/service.js';
import { readSessionTokenFromEvent } from './sessionCookie.js';

interface RequestEmailChangeBody {
  email?: string;
  currentPassword?: string;
  origin?: string;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  try {
    const body = requireJsonBody<RequestEmailChangeBody>(event, 'auth', 'INVALID_AUTH_EMAIL_CHANGE_REQUEST_BODY');
    const result = await requestEmailChange(
      readSessionTokenFromEvent(event) || '',
      String(body.email || ''),
      String(body.currentPassword || ''),
      String(body.origin || ''),
    );
    logInfo('Requested email change');
    return jsonOk(result, { origin });
  } catch (error) {
    logError('Failed to request email change', error);
    return jsonError(getStatusCode(error), toApiErrorBody('auth', error, 'AUTH_EMAIL_CHANGE_REQUEST_FAILED'), { origin });
  }
}