/**
 * Shopify OAuth 2.0 - One-shot callback server
 * 
 * 1. Opens the Shopify authorization URL in your browser
 * 2. Listens on localhost:3000/auth/callback
 * 3. Exchanges the code for an access token automatically
 * 4. Saves VITE_SHOPIFY_OAUTH_ACCESS_TOKEN to .env.local
 */

import http from 'http';
import { URL } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { exec } from 'child_process';

const dotenv = (await import('dotenv')).default;
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const CLIENT_ID = process.env.VITE_SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_SHOPIFY_CLIENT_SECRET;
const STORE_DOMAIN = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const SCOPES = 'write_products,read_products,read_inventory,write_inventory';
const STATE = Math.random().toString(36).substring(2, 10);

if (!CLIENT_ID || !CLIENT_SECRET || !STORE_DOMAIN) {
  console.error('✗ Missing VITE_SHOPIFY_CLIENT_ID, VITE_SHOPIFY_CLIENT_SECRET, or VITE_SHOPIFY_STORE_DOMAIN in .env.local');
  process.exit(1);
}

const authUrl = `https://${STORE_DOMAIN}/admin/oauth/authorize?` +
  `client_id=${CLIENT_ID}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&state=${STATE}`;

console.log('\n🔐 Shopify OAuth 2.0 Setup\n');
console.log(`Store:     ${STORE_DOMAIN}`);
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Scopes:    ${SCOPES}`);
console.log(`\nStarting local callback server on port 3000...`);

const { default: axios } = await import('axios');

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, 'http://localhost:3000');

  if (reqUrl.pathname !== '/auth/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = reqUrl.searchParams.get('code');
  const returnedState = reqUrl.searchParams.get('state');
  const error = reqUrl.searchParams.get('error');

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ OAuth Error: ${error}</h2><p>You can close this tab.</p>`);
    console.error(`\n✗ OAuth error: ${error}`);
    server.close();
    process.exit(1);
  }

  if (returnedState !== STATE) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ State mismatch — possible CSRF</h2><p>You can close this tab.</p>`);
    console.error('\n✗ State mismatch — aborting');
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ No code received</h2>`);
    server.close();
    process.exit(1);
  }

  console.log(`\n✓ Received authorization code`);
  console.log(`Exchanging code for access token...`);

  try {
    const tokenRes = await axios.post(
      `https://${STORE_DOMAIN}/admin/oauth/access_token`,
      { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code }
    );

    const accessToken = tokenRes.data.access_token;
    const scope = tokenRes.data.scope;

    console.log(`\n✓ Access token received!`);
    console.log(`  Scopes: ${scope}`);

    // Update .env.local
    let envContent = readFileSync('.env.local', 'utf8');
    if (envContent.includes('VITE_SHOPIFY_OAUTH_ACCESS_TOKEN=')) {
      envContent = envContent.replace(
        /VITE_SHOPIFY_OAUTH_ACCESS_TOKEN=.*/,
        `VITE_SHOPIFY_OAUTH_ACCESS_TOKEN=${accessToken}`
      );
    } else {
      envContent = envContent.trimEnd() + `\nVITE_SHOPIFY_OAUTH_ACCESS_TOKEN=${accessToken}\n`;
    }
    writeFileSync('.env.local', envContent);

    console.log(`\n✓ Saved to .env.local as VITE_SHOPIFY_OAUTH_ACCESS_TOKEN`);
    console.log(`\nRun: node test-shopify-connection.mjs`);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;max-width:600px">
        <h2>✅ Connected to Shopify!</h2>
        <p>Access token saved to <code>.env.local</code>.</p>
        <p>You can close this tab and return to your terminal.</p>
      </body></html>
    `);

    server.close();
    process.exit(0);

  } catch (err) {
    const msg = err.response?.data ?? err.message;
    console.error('\n✗ Token exchange failed:');
    console.error(JSON.stringify(msg, null, 2));

    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Token exchange failed</h2><pre>${JSON.stringify(msg, null, 2)}</pre>`);
    server.close();
    process.exit(1);
  }
});

server.listen(3000, () => {
  console.log(`✓ Listening on http://localhost:3000\n`);
  console.log(`Opening browser to authorize...`);
  console.log(`\nIf it doesn't open automatically, visit:\n${authUrl}\n`);

  // Open browser on macOS
  exec(`open "${authUrl}"`);
});
