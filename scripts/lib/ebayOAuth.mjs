const BASE = 'https://api.ebay.com/oauth/api_scope';

export const EBAY_OAUTH_SCOPES = [
  BASE,
  `${BASE}/sell.inventory`,
  `${BASE}/sell.account`,
  `${BASE}/sell.fulfillment`,
  `${BASE}/commerce.notification.subscription`,
  `${BASE}/sell.cancellation`,
  `${BASE}/sell.return`,
];

export function resolveScopes(configured) {
  const scopes = (configured ?? '').split(/\s+/).filter(Boolean);
  return scopes.length > 0 ? scopes : [...EBAY_OAUTH_SCOPES];
}

// eBay rejects "+" for spaces, so scopes are encoded with %20.
export function buildEbayConsentUrl({ authBase, clientId, ruName, scopes }) {
  return `${authBase}/oauth2/authorize?${[
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(ruName)}`,
    'response_type=code',
    `scope=${encodeURIComponent(scopes.join(' '))}`,
    'state=ebay_oauth',
  ].join('&')}`;
}

export function extractAuthorizationCode(input) {
  const value = (input ?? '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).searchParams.get('code')?.trim() ?? '';
    } catch {
      return '';
    }
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function replaceEnvValue(rawEnv, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(rawEnv)) {
    return rawEnv.replace(pattern, () => line);
  }

  return `${rawEnv}${rawEnv.endsWith('\n') || rawEnv === '' ? '' : '\n'}${line}\n`;
}
