import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load .env.local then .env
const dotenv = (await import('dotenv')).default;
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_ADMIN_API_TOKEN;
const oauthToken = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
const accessToken = oauthToken || token;
const authMethod = oauthToken ? 'OAuth 2.0' : token ? 'Admin API Token' : 'None';

console.log('Testing Shopify connection...\n');
console.log(`Store Domain:        ${domain ? `✓ Set (${domain})` : '✗ Not set'}`);
console.log(`Auth Method:         ${authMethod}`);
console.log(`Access Token:        ${accessToken ? `✓ Set (${accessToken.slice(0, 8)}...)` : '✗ Not set'}`);

if (!domain || !accessToken) {
  console.error('\n✗ Missing credentials!');
  if (!domain) {
    console.error('  • Set VITE_SHOPIFY_STORE_DOMAIN');
  }
  if (!accessToken) {
    console.error('  • Set VITE_SHOPIFY_ADMIN_API_TOKEN (Admin API)');
    console.error('    OR VITE_SHOPIFY_OAUTH_ACCESS_TOKEN (OAuth 2.0)');
    console.error('\n📖 Run: node setup-shopify-oauth.mjs');
  }
  process.exit(1);
}

if (domain === 'your-store.myshopify.com' || accessToken === 'your_shopify_admin_api_token') {
  console.error('\n✗ Please set actual credentials in .env.local');
  process.exit(1);
}

const { default: axios } = await import('axios');

try {
  console.log('\nConnecting to Shopify Admin API...');

  // Test basic shop info
  const shopRes = await axios.get(`https://${domain}/admin/api/2024-04/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  });

  const shop = shopRes.data.shop;
  console.log(`\n✓ Connected to Shopify successfully!`);
  console.log(`  Shop Name:    ${shop.name}`);
  console.log(`  Email:        ${shop.email}`);
  console.log(`  Plan:         ${shop.plan_name}`);
  console.log(`  Currency:     ${shop.currency}`);

  // Fetch a few products
  const productsRes = await axios.get(`https://${domain}/admin/api/2024-04/products.json?limit=5`, {
    headers: { 'X-Shopify-Access-Token': accessToken }
  });

  const products = productsRes.data.products;
  console.log(`\n✓ Found ${products.length} product(s) (showing up to 5):`);
  for (const p of products) {
    console.log(`  [${p.id}] ${p.title} — status: ${p.status}`);
  }

  if (products.length === 0) {
    console.log('  (No products found — store may be empty)');
  }

} catch (err) {
  const status = err.response?.status;
  const data = err.response?.data;
  console.error(`\n✗ Shopify connection failed (HTTP ${status ?? 'N/A'})`);
  console.error(JSON.stringify(data ?? { message: err.message }, null, 2));
  process.exit(1);
}
