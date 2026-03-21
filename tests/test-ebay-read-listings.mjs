import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
    .split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const clientId = env.VITE_EBAY_CLIENT_ID ?? '';
const clientSecret = env.VITE_EBAY_CLIENT_SECRET ?? '';
const refreshToken = env.VITE_EBAY_REFRESH_TOKEN ?? '';
const isSandbox = (env.VITE_EBAY_ENV ?? 'sandbox').toLowerCase() !== 'production';
const apiBase = env.VITE_EBAY_API_BASE ?? (isSandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com');

if (!clientId || !clientSecret || !refreshToken) {
  console.error('Missing VITE_EBAY_CLIENT_ID, VITE_EBAY_CLIENT_SECRET, or VITE_EBAY_REFRESH_TOKEN in .env.local');
  process.exit(1);
}

const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

const tokenRes = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    Authorization: `Basic ${credentials}`,
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }).toString(),
});

const tokenData = await tokenRes.json();
if (!tokenRes.ok) {
  console.error('Token refresh failed');
  console.error(JSON.stringify(tokenData, null, 2));
  process.exit(1);
}

const accessToken = tokenData.access_token;

const [inventoryRes, offersRes] = await Promise.all([
  fetch(`${apiBase}/sell/inventory/v1/inventory_item?limit=10`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
    },
  }),
  fetch(`${apiBase}/sell/inventory/v1/offer?limit=10`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'en-US',
    },
  }),
]);

const inventoryText = await inventoryRes.text();
const offersText = await offersRes.text();

console.log('Inventory status:', inventoryRes.status);
console.log(inventoryText);
console.log('');
console.log('Offer status:', offersRes.status);
console.log(offersText);
