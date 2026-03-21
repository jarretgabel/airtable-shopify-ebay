import type { EbayTokenResponse } from './types';
import { API, CLIENT_ID, CLIENT_SECRET, EBAY_AUTH_HOST, SCOPES, getRuName } from './config';
import { clearUserToken, getStoredRefreshToken } from './tokenStorage';

/** Build the authorization URL the user needs to visit to grant access. */
export function buildAuthUrl(ruName?: string): string {
  const rn = ruName ?? getRuName();
  // Build manually to ensure spaces in scope are encoded as %20, not +.
  // URLSearchParams.toString() uses + for spaces, which eBay's OAuth server rejects.
  const base = `${EBAY_AUTH_HOST}/oauth2/authorize`;
  const query = [
    `client_id=${encodeURIComponent(CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(rn)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(SCOPES)}`,
    `state=ebay_oauth`,
  ].join('&');
  return `${base}?${query}`;
}

/** Exchange an authorization code for user access + refresh tokens. */
export async function exchangeCodeForToken(code: string): Promise<EbayTokenResponse> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRuName(),
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    const desc = (err.error_description as string) || JSON.stringify(err);
    const errorId = (err.error_id as string) || String(res.status);
    if (errorId === 'temporarily_unavailable') {
      throw new Error(
        'eBay auth server is temporarily unavailable. This usually means the RuName does not ' +
          'match a registered redirect URI in your eBay developer app, or the sandbox is down. ' +
          'Verify your RuName in the developer portal (see setup instructions below).',
      );
    }
    throw new Error(`Token exchange failed [${errorId}]: ${desc}`);
  }
  return res.json() as Promise<EbayTokenResponse>;
}

/** Refresh the user access token using a stored refresh token. */
export async function refreshAccessToken(): Promise<EbayTokenResponse> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored.');

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  // Scope is intentionally omitted — eBay defaults to the original grant's scopes.
  // Sending scope on refresh causes invalid_request if it doesn't match the original grant.
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    // Any refresh failure means the token is unusable — clear it so the UI falls back to OAuth.
    clearUserToken();
    const errorCode = (err.error as string) || 'token_refresh_failed';
    throw Object.assign(
      new Error(
        `Stored eBay session expired or invalid (${errorCode}). Click Connect with eBay to reconnect.`,
      ),
      { code: 'auth_required' },
    );
  }
  return res.json() as Promise<EbayTokenResponse>;
}

/** Get an Application Token via Client Credentials (no user needed). */
export async function getAppToken(): Promise<string> {
  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  });

  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`App token failed ${res.status}: ${JSON.stringify(err)}`);
  }
  const data = await res.json() as EbayTokenResponse;
  return data.access_token;
}