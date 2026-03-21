/**
 * eBay token management — storage, OAuth exchange, refresh, and app token.
 */
import { refreshAccessToken, exchangeCodeForToken, buildAuthUrl, getAppToken } from './tokenOAuth';
import {
  getStoredUserToken,
  getStoredRefreshToken,
  saveUserToken,
  clearUserToken,
  isTokenValid,
  hasValidSession,
  seedRefreshTokenFromEnv,
} from './tokenStorage';

// Seed localStorage with the env refresh token on first load (if not already set).
seedRefreshTokenFromEnv();

// ─── In-flight deduplication ──────────────────────────────────────────────────

let pendingUserTokenPromise: Promise<string> | null = null;

export {
  saveUserToken,
  getStoredUserToken,
  clearUserToken,
  isTokenValid,
  hasValidSession,
  buildAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getAppToken,
};

// ─── Active token accessor ────────────────────────────────────────────────────

export async function getValidUserToken(): Promise<string> {
  const stored = getStoredUserToken();

  // Valid, non-expired access token — use it directly.
  if (stored && Date.now() < stored.expiresAt) return stored.accessToken;

  // React Strict Mode and parallel data fetches can ask for a user token at the
  // same time. Share the in-flight refresh so we don't race the eBay token endpoint.
  if (pendingUserTokenPromise) return pendingUserTokenPromise;

  // No valid access token — attempt refresh if we have a refresh token.
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('Not authenticated with eBay.');

  pendingUserTokenPromise = refreshAccessToken()
    .then(refreshed => {
      saveUserToken(refreshed);
      return refreshed.access_token;
    })
    .finally(() => {
      pendingUserTokenPromise = null;
    });

  return pendingUserTokenPromise;
}
