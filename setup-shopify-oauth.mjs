#!/usr/bin/env node

/**
 * Shopify OAuth 2.0 Setup Helper
 * 
 * Usage:
 * 1. Set up your app in Shopify Admin:
 *    - Settings → Apps and sales channels → Develop apps
 *    - Create new app, set redirect URI to http://localhost:3000/auth/callback
 *    - Copy CLIENT_ID and CLIENT_SECRET
 * 
 * 2. Get authorization code:
 *    node setup-shopify-oauth.mjs --step auth --client-id YOUR_CLIENT_ID
 * 
 * 3. Exchange code for token:
 *    node setup-shopify-oauth.mjs --step token --client-id YOUR_CLIENT_ID --client-secret YOUR_SECRET --code AUTH_CODE
 */

import { createRequire } from 'module';
import { argv } from 'process';

const require = createRequire(import.meta.url);

// Load env files
const dotenv = (await import('dotenv')).default;
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const step = argv.find(a => a.startsWith('--step'))?.split('=')[1] || 'help';
const clientId = argv.find(a => a.startsWith('--client-id'))?.split('=')[1] || process.env.VITE_SHOPIFY_CLIENT_ID;
const clientSecret = argv.find(a => a.startsWith('--client-secret'))?.split('=')[1] || process.env.VITE_SHOPIFY_CLIENT_SECRET;
const authCode = argv.find(a => a.startsWith('--code'))?.split('=')[1];
const storeDomain = process.env.VITE_SHOPIFY_STORE_DOMAIN || argv.find(a => a.startsWith('--store'))?.split('=')[1];

if (step === 'help' || !step) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║              Shopify OAuth 2.0 Setup Helper                    ║
╚════════════════════════════════════════════════════════════════╝

STEP 1: Register Your App
─────────────────────────
1. Go to: https://<your-store>.myshopify.com/admin
2. Navigate to: Settings → Apps and sales channels → Develop apps
3. Click "Create an app"
4. Name your app and click "Create"
5. Go to "Configuration" tab
6. Under "Admin API scopes", enable:
   - read_products
   - write_products
   (add more as needed)
7. Copy your:
   - CLIENT_ID
   - CLIENT_SECRET

STEP 2: Generate Authorization Code
────────────────────────────────────
Run:
  node setup-shopify-oauth.mjs --step auth --client-id YOUR_CLIENT_ID --store your-store.myshopify.com

This will print an authorization URL. Open it in your browser and grant access.
You'll get an authorization CODE in the redirect URL.

STEP 3: Exchange Code for Access Token
──────────────────────────────────────
Run:
  node setup-shopify-oauth.mjs --step token \\
    --client-id YOUR_CLIENT_ID \\
    --client-secret YOUR_CLIENT_SECRET \\
    --code AUTH_CODE \\
    --store your-store.myshopify.com

STEP 4: Save Token to .env.local
────────────────────────────────
Add to your .env.local:
  VITE_SHOPIFY_OAUTH_ACCESS_TOKEN=<the-token-from-step-3>

Then test the connection:
  node test-shopify-connection.mjs
`);
  process.exit(0);
}

if (step === 'auth') {
  if (!clientId || !storeDomain) {
    console.error('Error: --client-id and --store are required for auth step');
    process.exit(1);
  }

  const redirectUri = 'http://localhost:3000/auth/callback';
  const scopes = 'write_products,read_products';
  const state = Math.random().toString(36).substring(7);

  const authUrl = `https://${storeDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  console.log('\n✓ Authorization URL generated:\n');
  console.log(authUrl);
  console.log(`\n1. Open the URL above in your browser`);
  console.log(`2. Click "Install" to grant permissions`);
  console.log(`3. You'll be redirected to a URL like:`);
  console.log(`   http://localhost:3000/auth/callback?code=AUTH_CODE&state=${state}`);
  console.log(`\n4. Copy the AUTH_CODE value and use it in the token exchange step`);
  process.exit(0);
}

if (step === 'token') {
  if (!clientId || !clientSecret || !authCode || !storeDomain) {
    console.error('Error: --client-id, --client-secret, --code, and --store are required for token step');
    process.exit(1);
  }

  const { default: axios } = await import('axios');

  try {
    console.log('\nExchanging authorization code for access token...\n');

    const response = await axios.post(`https://${storeDomain}/admin/oauth/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code: authCode,
    });

    const accessToken = response.data.access_token;
    console.log('✓ Token exchange successful!\n');
    console.log('Add this to your .env.local:\n');
    console.log(`  VITE_SHOPIFY_OAUTH_ACCESS_TOKEN=${accessToken}\n`);
    console.log('Then run: node test-shopify-connection.mjs');
  } catch (err) {
    console.error('✗ Token exchange failed:');
    console.error(err.response?.data ?? err.message);
    process.exit(1);
  }
}
