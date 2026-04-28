import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export const AUTH_SESSION_COOKIE_NAME = 'lcc_session';
const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_AUTH_COOKIE_SECURE_MODE = 'auto';
const DEFAULT_AUTH_COOKIE_SAME_SITE = 'Lax';

type AuthCookieSecureMode = 'auto' | 'always' | 'never';
type AuthCookieSameSite = 'Strict' | 'Lax' | 'None';

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getCookieSecureMode(): AuthCookieSecureMode {
  const raw = (process.env.APP_AUTH_COOKIE_SECURE_MODE || DEFAULT_AUTH_COOKIE_SECURE_MODE).trim().toLowerCase();
  if (raw === 'always' || raw === 'never' || raw === 'auto') {
    return raw;
  }

  return 'auto';
}

function getCookieSameSite(): AuthCookieSameSite {
  const raw = (process.env.APP_AUTH_COOKIE_SAME_SITE || DEFAULT_AUTH_COOKIE_SAME_SITE).trim().toLowerCase();
  if (raw === 'strict') return 'Strict';
  if (raw === 'none') return 'None';
  return 'Lax';
}

function getCookieDomain(): string | undefined {
  const raw = (process.env.APP_AUTH_COOKIE_DOMAIN || '').trim();
  return raw || undefined;
}

function shouldUseSecureCookie(): boolean {
  const mode = getCookieSecureMode();
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  return true;
}

function buildCookieParts(): string[] {
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  return [
    'Path=/',
    `Max-Age=${AUTH_SESSION_MAX_AGE_SECONDS}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
    ...(domain ? [`Domain=${domain}`] : []),
    ...(shouldUseSecureCookie() || sameSite === 'None' ? ['Secure'] : []),
  ];
}

export function buildSessionCookie(sessionToken: string): string {
  return [
    `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`,
    ...buildCookieParts(),
  ].join('; ');
}

export function buildClearedSessionCookie(): string {
  const sameSite = getCookieSameSite();
  const domain = getCookieDomain();
  return [
    `${AUTH_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    `SameSite=${sameSite}`,
    ...(domain ? [`Domain=${domain}`] : []),
    ...(shouldUseSecureCookie() || sameSite === 'None' ? ['Secure'] : []),
  ].join('; ');
}

export function readSessionTokenFromEvent(event: APIGatewayProxyEventV2): string | undefined {
  const cookieEntries = event.cookies ?? [];

  for (const entry of cookieEntries) {
    const [rawName, ...rest] = entry.split('=');
    if (rawName?.trim() !== AUTH_SESSION_COOKIE_NAME) {
      continue;
    }

    const rawValue = rest.join('=').trim();
    return rawValue ? decodeCookieValue(rawValue) : undefined;
  }

  return undefined;
}