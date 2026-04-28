import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getRequestOrigin, jsonOk } from '../../shared/http.js';
import { logInfo } from '../../shared/logging.js';
import { buildClearedSessionCookie } from './sessionCookie.js';

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const origin = getRequestOrigin(event);
  logInfo('Cleared auth session cookie');
  return jsonOk({ success: true }, { origin, cookies: [buildClearedSessionCookie()] });
}