/**
 * eBay Production — OAuth + Create Draft Listing CLI Tool
 *
 * Usage:
 *   Step 1: nvm use 20 && node tests/test-create-ebay-listing.mjs --api=inventory
 *           → Prints the OAuth URL. Visit it in your browser.
 *
 *   Step 2: After eBay redirects to http://localhost:3000?code=XXX&state=ebay_oauth,
 *           copy the `code` value from the URL bar (everything after `code=` and before `&`).
 *
 *   Step 3: nvm use 20 && node tests/test-create-ebay-listing.mjs --api=inventory --code=YOUR_CODE_HERE
 *           → Exchanges code for tokens, saves refresh token to .env.local, creates listing.
 *
 *   Optional: Use --api=trading to create a live fixed-price listing via Trading API.
 *   Optional: Use --api=trading-verify to validate the Trading payload without creating a listing.
 */

import { readFileSync, writeFileSync } from 'fs';
import {
  createDraftListing,
  createTradingListing,
  normalizeCode,
  normalizeToken,
  saveRefreshToken,
} from './helpers/ebay-listing-cli-helpers.mjs';

// ── Load .env.local ────────────────────────────────────────────────────────────
const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;
const rawEnv = readFileSync(ENV_PATH, 'utf-8');
const env = Object.fromEntries(
  rawEnv
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const CLIENT_ID     = env['VITE_EBAY_CLIENT_ID'] ?? '';
const CLIENT_SECRET = env['VITE_EBAY_CLIENT_SECRET'] ?? '';
const RU_NAME       = env['VITE_EBAY_RU_NAME'] ?? '';
const IS_SANDBOX    = (env['VITE_EBAY_ENV'] ?? 'sandbox').toLowerCase() !== 'production';

const API_BASE  = env['VITE_EBAY_API_BASE'] ?? (IS_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com');
const AUTH_BASE = env['VITE_EBAY_AUTH_BASE'] ?? (IS_SANDBOX ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com');

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
].join(' ');

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

console.log('eBay Production — Create Listing Script');
console.log('═══════════════════════════════════════════════');
console.log(`Env       : ${IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Client ID : ${CLIENT_ID}`);
console.log(`RuName    : ${RU_NAME || '(not set — set VITE_EBAY_RU_NAME)'}`);
console.log(`API Base  : ${API_BASE}`);
console.log('');

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: VITE_EBAY_CLIENT_ID and VITE_EBAY_CLIENT_SECRET not set in .env.local');
  process.exit(1);
}

// ── Parse CLI args ─────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const [k, ...rest] = a.slice(2).split('=');
      return [k, rest.join('=')];
    })
);

  const rawApiMode = args.api?.toLowerCase();
  const API_MODE = rawApiMode === 'trading' || rawApiMode === 'trading-verify' ? rawApiMode : 'inventory';
  const LOCATION_NAME = env['VITE_EBAY_LOCATION_NAME'] ?? 'Resolution AV Warehouse';
  const LOCATION_POSTAL_CODE = env['VITE_EBAY_LOCATION_POSTAL_CODE'] ?? '';
  const LOCATION_CITY = env['VITE_EBAY_LOCATION_CITY'] ?? '';
  const LOCATION_STATE = env['VITE_EBAY_LOCATION_STATE'] ?? '';
  const FULFILLMENT_POLICY_ID = env['VITE_EBAY_FULFILLMENT_POLICY_ID'] ?? '';
  const PAYMENT_POLICY_ID = env['VITE_EBAY_PAYMENT_POLICY_ID'] ?? '';
  const RETURN_POLICY_ID = env['VITE_EBAY_RETURN_POLICY_ID'] ?? '';


// ── Main flow ─────────────────────────────────────────────────────────────────

if (args.code) {
  // ── Token exchange path ────────────────────────────────────────────────────
  const oauthCode = normalizeCode(args.code);
  console.log('Step 1: Exchanging authorization code for user token…');
  const tokenRes = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: oauthCode,
      redirect_uri: RU_NAME,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    console.error(`✗ Token exchange failed: HTTP ${tokenRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    console.error('\nCommon causes:');
    console.error('  • The authorization code expired (codes are valid for ~5 minutes)');
    console.error('  • The RuName doesn\'t match the one used when you started the OAuth flow');
    console.error('  • The code was already used (each code is single-use)');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  console.log(`✓ User token obtained — expires in ${tokenData.expires_in}s`);

  if (tokenData.refresh_token) {
    console.log('\nStep 2: Saving refresh token to .env.local…');
    saveRefreshToken(ENV_PATH, tokenData.refresh_token);
  }

  if (API_MODE === 'trading') {
    await createTradingListing(tokenData.access_token, API_MODE, API_BASE, {
      locationName: LOCATION_NAME,
      locationPostalCode: LOCATION_POSTAL_CODE,
      locationCity: LOCATION_CITY,
      locationState: LOCATION_STATE,
      fulfillmentPolicyId: FULFILLMENT_POLICY_ID,
      paymentPolicyId: PAYMENT_POLICY_ID,
      returnPolicyId: RETURN_POLICY_ID,
    });
  } else if (API_MODE === 'trading-verify') {
    await createTradingListing(tokenData.access_token, API_MODE, API_BASE, {
      locationName: LOCATION_NAME,
      locationPostalCode: LOCATION_POSTAL_CODE,
      locationCity: LOCATION_CITY,
      locationState: LOCATION_STATE,
      fulfillmentPolicyId: FULFILLMENT_POLICY_ID,
      paymentPolicyId: PAYMENT_POLICY_ID,
      returnPolicyId: RETURN_POLICY_ID,
    });
  } else {
    await createDraftListing(tokenData.access_token, API_BASE);
  }

} else if (env['VITE_EBAY_REFRESH_TOKEN']) {
  // ── Refresh token path ─────────────────────────────────────────────────────
  console.log('Step 1: Refreshing access token from stored refresh token…');
  const tokenRes = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: normalizeToken(env['VITE_EBAY_REFRESH_TOKEN']),
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    console.error(`✗ Token refresh failed: HTTP ${tokenRes.status}`);
    console.error(JSON.stringify(err, null, 2));
    console.log('\nRun without --code to get a fresh OAuth URL and re-authenticate.');
    process.exit(1);
  }

  const tokenData = await tokenRes.json();
  console.log(`✓ Access token refreshed — expires in ${tokenData.expires_in}s`);
  if (tokenData.refresh_token) saveRefreshToken(ENV_PATH, tokenData.refresh_token);

  if (API_MODE === 'trading') {
    await createTradingListing(tokenData.access_token, API_MODE, API_BASE, {
      locationName: LOCATION_NAME,
      locationPostalCode: LOCATION_POSTAL_CODE,
      locationCity: LOCATION_CITY,
      locationState: LOCATION_STATE,
      fulfillmentPolicyId: FULFILLMENT_POLICY_ID,
      paymentPolicyId: PAYMENT_POLICY_ID,
      returnPolicyId: RETURN_POLICY_ID,
    });
  } else if (API_MODE === 'trading-verify') {
    await createTradingListing(tokenData.access_token, API_MODE, API_BASE, {
      locationName: LOCATION_NAME,
      locationPostalCode: LOCATION_POSTAL_CODE,
      locationCity: LOCATION_CITY,
      locationState: LOCATION_STATE,
      fulfillmentPolicyId: FULFILLMENT_POLICY_ID,
      paymentPolicyId: PAYMENT_POLICY_ID,
      returnPolicyId: RETURN_POLICY_ID,
    });
  } else {
    await createDraftListing(tokenData.access_token, API_BASE);
  }

} else {
  // ── OAuth URL path (no code yet) ───────────────────────────────────────────
  if (!RU_NAME) {
    console.error('ERROR: VITE_EBAY_RU_NAME is not set in .env.local');
    console.error('  1. Go to developer.ebay.com/my/keys → your production app → User Tokens');
    console.error('  2. Register http://localhost:3000 as a redirect URL');
    console.error('  3. Copy the RuName and add it to .env.local as VITE_EBAY_RU_NAME');
    process.exit(1);
  }

  // Build auth URL with proper %20 encoding (not + which eBay rejects)
  const authUrl = AUTH_BASE + '/oauth2/authorize?' + [
    `client_id=${encodeURIComponent(CLIENT_ID)}`,
    `redirect_uri=${encodeURIComponent(RU_NAME)}`,
    `response_type=code`,
    `scope=${encodeURIComponent(SCOPES)}`,
    `state=ebay_oauth`,
  ].join('&');

  console.log('Step 1: Visit this URL in your browser to authorize the app:\n');
  console.log(`  ${authUrl}`);
  console.log('');
  console.log('  After granting access, eBay will redirect to:');
  console.log('  http://localhost:3000?code=XXXX&state=ebay_oauth');
  console.log('');
  console.log('Step 2: Copy the `code` value from the URL bar, then run:\n');
  console.log('  node tests/test-create-ebay-listing.mjs --code=PASTE_CODE_HERE');
  console.log('');
  console.log('Note: The app at localhost:3000 will ALSO auto-handle the code — you');
  console.log('      only need this script if the app\'s connect flow isn\'t working.');
}
