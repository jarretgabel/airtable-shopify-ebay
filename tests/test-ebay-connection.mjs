/**
 * eBay Sandbox connection test — verifies credentials and gets an app token.
 * Run with: nvm use 20 && node tests/test-ebay-connection.mjs
 *
 * Note: This tests the Application Token (Client Credentials) only.
 * Seller operations (create listings, view inventory) require a User Token
 * obtained via the OAuth flow in the browser.
 */

import { readFileSync } from 'fs';

const ENV_PATH = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf-8')
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

const API_BASE  = IS_SANDBOX ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const AUTH_BASE = IS_SANDBOX ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: VITE_EBAY_CLIENT_ID and VITE_EBAY_CLIENT_SECRET must be set in .env.local');
  process.exit(1);
}

console.log('eBay Sandbox Connection Test');
console.log('────────────────────────────────');
console.log(`Client ID : ${CLIENT_ID}`);
console.log(`RuName    : ${RU_NAME || '(not set)'}`);
console.log(`Env       : ${IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION'}`);
console.log(`Auth URL  : ${AUTH_BASE}`);
console.log(`API Base  : ${API_BASE}`);
console.log('');

// ── Step 1: Get App Token (Client Credentials) ────────────────────────────────
console.log('Step 1: Getting Application Token (Client Credentials)…');

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const tokenRes = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${credentials}`,
  },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope',
  }).toString(),
});

const elapsed = (ms) => `${(ms / 1000).toFixed(1)}s`;
const t0 = Date.now();

if (!tokenRes.ok) {
  const err = await tokenRes.json().catch(() => ({}));
  console.error(`\n✗ Token request failed: HTTP ${tokenRes.status}`);
  console.error(JSON.stringify(err, null, 2));
  process.exit(1);
}

const tokenData = await tokenRes.json();
console.log(`✓ App Token obtained (${elapsed(Date.now() - t0)})`);
console.log(`  Type      : ${tokenData.token_type}`);
console.log(`  Expires   : ${tokenData.expires_in}s`);
console.log(`  Token     : ${tokenData.access_token.slice(0, 30)}…`);
console.log('');

// ── Step 2: Verify token with a browse API call ───────────────────────────────
console.log('Step 2: Verifying token with Browse API (search "McIntosh amplifier")…');

const t1 = Date.now();
const searchRes = await fetch(
  `${API_BASE}/buy/browse/v1/item_summary/search?q=McIntosh+amplifier&limit=3`,
  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
);

if (!searchRes.ok) {
  const err = await searchRes.json().catch(() => ({}));
  console.error(`✗ Browse API failed: HTTP ${searchRes.status}`);
  console.error(JSON.stringify(err, null, 2));
  process.exit(1);
}

const searchData = await searchRes.json();
const items = searchData.itemSummaries ?? [];
console.log(`✓ Browse API responding (${elapsed(Date.now() - t1)}) — ${searchData.total ?? 0} total results`);

if (items.length > 0) {
  console.log('\n  Sample listings found in sandbox:');
  items.forEach((item, i) => {
    console.log(`  ${i + 1}. ${item.title}`);
    console.log(`     Price: ${item.price?.value} ${item.price?.currency}`);
    console.log(`     Item ID: ${item.itemId}`);
  });
}

// ── Step 3: OAuth URL ─────────────────────────────────────────────────────────
console.log('');
console.log('Step 3: OAuth Authorization URL for User Token');
if (!RU_NAME) {
  console.log('  ⚠  VITE_EBAY_RU_NAME is not set.');
  console.log('  To get a user token (required for seller operations):');
  console.log('  1. Go to developer.ebay.com → your app → User Tokens');
  console.log('  2. Register redirect URL: http://localhost:3000');
  console.log('  3. Copy the RuName and set VITE_EBAY_RU_NAME in .env.local');
} else {
  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  ].join(' ');

  const authUrl = `${AUTH_BASE}/oauth2/authorize?` + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: RU_NAME,
    response_type: 'code',
    scope: scopes,
    state: 'ebay_oauth',
  }).toString();

  console.log('  To authorize as a seller, open this URL in a browser:');
  console.log(`\n  ${authUrl}\n`);
  console.log('  After authorizing, the browser will redirect to localhost:3000');
  console.log('  with ?code=... — the app will automatically exchange it for a user token.');
}

console.log('');
console.log('✅ eBay sandbox connection working correctly.');
