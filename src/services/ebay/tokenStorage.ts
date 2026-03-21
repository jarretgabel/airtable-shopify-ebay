import type { EbayTokenResponse } from './types';
import {
  LS_ACCESS,
  LS_EXPIRY,
  LS_REFRESH,
  normalizeToken,
  normalizedEnvRefreshToken,
} from './config';

export function seedRefreshTokenFromEnv(): void {
  if (
    normalizedEnvRefreshToken &&
    localStorage.getItem(LS_REFRESH) !== normalizedEnvRefreshToken
  ) {
    localStorage.setItem(LS_REFRESH, normalizedEnvRefreshToken);
  }
}

export function getStoredRefreshToken(): string | null {
  const stored = localStorage.getItem(LS_REFRESH);
  if (stored) return normalizeToken(stored);
  if (normalizedEnvRefreshToken) return normalizedEnvRefreshToken;
  return null;
}

export function saveUserToken(token: EbayTokenResponse): void {
  localStorage.setItem(LS_ACCESS, token.access_token);
  localStorage.setItem(LS_EXPIRY, String(Date.now() + token.expires_in * 1000 - 60_000));
  if (token.refresh_token) localStorage.setItem(LS_REFRESH, normalizeToken(token.refresh_token));
}

export function getStoredUserToken(): { accessToken: string; expiresAt: number } | null {
  const t = localStorage.getItem(LS_ACCESS);
  const e = localStorage.getItem(LS_EXPIRY);
  if (!t || !e) return null;
  return { accessToken: t, expiresAt: Number(e) };
}

export function clearUserToken(): void {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_EXPIRY);
}

export function isTokenValid(): boolean {
  const stored = getStoredUserToken();
  if (!stored) return false;
  return Date.now() < stored.expiresAt;
}

/** True when a valid access token OR a refresh token is available. */
export function hasValidSession(): boolean {
  return isTokenValid() || !!getStoredRefreshToken();
}