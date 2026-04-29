import { createHmac, timingSafeEqual } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { HttpError } from './errors.js';

const CSRF_HEADER_NAME = 'x-csrf-token';

function getCsrfSecret(): string {
  const secret = (process.env.APP_AUTH_CSRF_SECRET || process.env.APP_AUTH_TOKEN_SECRET || '').trim();
  if (secret) {
    return secret;
  }

  return 'local-dev-auth-secret';
}

function normalizeToken(value: string | undefined): string {
  return value?.trim() || '';
}

function readHeader(event: APIGatewayProxyEventV2, name: string): string | undefined {
  return event.headers[name] || event.headers[name.toLowerCase()] || event.headers[name.toUpperCase()];
}

function isSafeMethod(event: APIGatewayProxyEventV2): boolean {
  const method = (event.requestContext?.http?.method || '').toUpperCase();
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export function buildCsrfToken(sessionToken: string): string {
  return createHmac('sha256', getCsrfSecret())
    .update(sessionToken)
    .digest('base64url');
}

export function requireSessionCsrf(event: APIGatewayProxyEventV2, sessionToken: string): void {
  if (isSafeMethod(event)) {
    return;
  }

  const normalizedSessionToken = normalizeToken(sessionToken);
  if (!normalizedSessionToken) {
    throw new HttpError(401, 'Session is invalid.', {
      service: 'auth',
      code: 'AUTH_SESSION_INVALID',
      retryable: false,
    });
  }

  const providedToken = normalizeToken(readHeader(event, CSRF_HEADER_NAME));
  if (!providedToken) {
    throw new HttpError(403, 'CSRF token is missing or invalid.', {
      service: 'auth',
      code: 'AUTH_CSRF_INVALID',
      retryable: false,
    });
  }

  const expectedToken = buildCsrfToken(normalizedSessionToken);
  const expectedBuffer = Buffer.from(expectedToken);
  const providedBuffer = Buffer.from(providedToken);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new HttpError(403, 'CSRF token is missing or invalid.', {
      service: 'auth',
      code: 'AUTH_CSRF_INVALID',
      retryable: false,
    });
  }
}