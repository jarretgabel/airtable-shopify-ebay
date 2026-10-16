// Usage:
//   npm run ebay:oauth                       prints the consent URL (no network, no writes)
//   npm run ebay:oauth -- --code="<code or the full redirected URL>"
//                                            exchanges the code and saves VITE_EBAY_REFRESH_TOKEN in .env.local
// Unlike tests/integration/test-create-ebay-listing.mjs, this never creates an eBay listing.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildEbayConsentUrl, extractAuthorizationCode, replaceEnvValue, resolveScopes } from './lib/ebayOAuth.mjs';

const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;
const rawEnv = readFileSync(ENV_PATH, 'utf-8');
const env = Object.fromEntries(
  rawEnv.split('\n').filter((l) => l.trim() && !l.startsWith('#') && l.includes('=')).map((l) => {
    const index = l.indexOf('=');
    return [l.slice(0, index).trim(), l.slice(index + 1).trim()];
  }),
);

const clientId = env.VITE_EBAY_CLIENT_ID ?? '';
const clientSecret = env.VITE_EBAY_CLIENT_SECRET ?? '';
const ruName = env.VITE_EBAY_RU_NAME ?? '';
const sandbox = (env.VITE_EBAY_ENV ?? 'sandbox').toLowerCase() !== 'production';
const apiBase = env.VITE_EBAY_API_BASE ?? (sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com');
const authBase = env.VITE_EBAY_AUTH_BASE ?? (sandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com');
const scopes = resolveScopes(env.VITE_EBAY_OAUTH_SCOPES);

if (!clientId || !clientSecret || !ruName) {
  console.error('VITE_EBAY_CLIENT_ID, VITE_EBAY_CLIENT_SECRET and VITE_EBAY_RU_NAME must be set in .env.local.');
  process.exit(1);
}

const codeArg = process.argv.slice(2).find((arg) => arg.startsWith('--code='));

if (!codeArg) {
  console.log(`Environment: ${sandbox ? 'SANDBOX' : 'PRODUCTION'}`);
  console.log('Scopes requested:');
  for (const scope of scopes) console.log(`  ${scope}`);
  console.log('\n1. Open this URL, sign in as the seller account and approve:\n');
  console.log(`  ${buildEbayConsentUrl({ authBase, clientId, ruName, scopes })}\n`);
  console.log('2. eBay redirects to http://localhost:3000/?code=...  Copy the whole address-bar URL (the code lasts ~5 minutes and works once).');
  console.log('3. Run: npm run ebay:oauth -- --code="PASTED_URL_OR_CODE"');
  console.log('If eBay shows invalid_scope, set VITE_EBAY_OAUTH_SCOPES in .env.local to a shorter list without the scope it names.');
  process.exit(0);
}

const code = extractAuthorizationCode(codeArg.slice('--code='.length));
if (!code) {
  console.error('No authorization code found in --code.');
  process.exit(1);
}

const response = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
  },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: ruName }).toString(),
});

const body = await response.json().catch(() => ({}));
if (!response.ok || !body.refresh_token) {
  console.error(`Token exchange failed: HTTP ${response.status} ${body.error ?? ''} ${body.error_description ?? ''}`.trim());
  console.error('The code may have expired, been used already, or been issued for a different RuName. Nothing was saved.');
  process.exit(1);
}

writeFileSync(ENV_PATH, replaceEnvValue(rawEnv, 'VITE_EBAY_REFRESH_TOKEN', encodeURIComponent(body.refresh_token)));
console.log('Saved the new refresh token to .env.local (VITE_EBAY_REFRESH_TOKEN). The token was not printed.');
console.log(`Refresh token lifetime: ${Math.round((body.refresh_token_expires_in ?? 0) / 86400)} days.`);
console.log('Next: restart the local API, then run: npm run ebay:notifications:setup -- --check-access');
