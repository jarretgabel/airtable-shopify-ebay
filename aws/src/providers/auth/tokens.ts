import crypto from 'node:crypto';
import { HttpError } from '../../shared/errors.js';
import { requireSecret } from '../../shared/secrets.js';

type TokenKind = 'session' | 'password-reset' | 'email-change';

interface BaseTokenPayload {
  kind: TokenKind;
  userId: string;
  exp: number;
}

interface SessionTokenPayload extends BaseTokenPayload {
  kind: 'session';
  mustChangePassword: boolean;
}

interface PasswordResetTokenPayload extends BaseTokenPayload {
  kind: 'password-reset';
}

interface EmailChangeTokenPayload extends BaseTokenPayload {
  kind: 'email-change';
  nextEmail: string;
}

export type AuthTokenPayload = SessionTokenPayload | PasswordResetTokenPayload | EmailChangeTokenPayload;

type AuthTokenPayloadByKind = {
  session: SessionTokenPayload;
  'password-reset': PasswordResetTokenPayload;
  'email-change': EmailChangeTokenPayload;
};

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function getSigningSecret(): string {
  return requireSecret('APP_AUTH_TOKEN_SECRET');
}

function sign(encodedPayload: string): string {
  return toBase64Url(crypto.createHmac('sha256', getSigningSecret()).update(encodedPayload).digest());
}

function encodePayload(payload: AuthTokenPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

function decodePayload(encodedPayload: string): AuthTokenPayload {
  return JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as AuthTokenPayload;
}

export function issueSessionToken(userId: string, mustChangePassword: boolean, ttlMs = 1000 * 60 * 60 * 24 * 14): string {
  const payload: SessionTokenPayload = {
    kind: 'session',
    userId,
    mustChangePassword,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function issuePasswordResetToken(userId: string, ttlMs = 1000 * 60 * 60): string {
  const payload: PasswordResetTokenPayload = {
    kind: 'password-reset',
    userId,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function issueEmailChangeToken(userId: string, nextEmail: string, ttlMs = 1000 * 60 * 60): string {
  const payload: EmailChangeTokenPayload = {
    kind: 'email-change',
    userId,
    nextEmail,
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyToken<K extends TokenKind>(token: string, expectedKind: K): AuthTokenPayloadByKind[K] {
  const [encodedPayload, providedSignature] = token.trim().split('.');
  if (!encodedPayload || !providedSignature) {
    throw new HttpError(400, 'Invalid token format', {
      service: 'auth',
      code: 'AUTH_INVALID_TOKEN',
      retryable: false,
    });
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new HttpError(400, 'Invalid token signature', {
      service: 'auth',
      code: 'AUTH_INVALID_TOKEN',
      retryable: false,
    });
  }

  const payload = decodePayload(encodedPayload);
  if (payload.kind !== expectedKind) {
    throw new HttpError(400, 'Token kind mismatch', {
      service: 'auth',
      code: 'AUTH_INVALID_TOKEN',
      retryable: false,
    });
  }

  if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
    throw new HttpError(400, 'Token is expired', {
      service: 'auth',
      code: 'AUTH_TOKEN_EXPIRED',
      retryable: false,
    });
  }

  return payload as AuthTokenPayloadByKind[K];
}