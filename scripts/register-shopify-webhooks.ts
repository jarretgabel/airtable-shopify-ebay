import dotenv from 'dotenv';
import { ensureRequiredWebhookSubscriptions } from '../aws/src/providers/shopify/client.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN
  || process.env.VITE_SHOPIFY_STORE_DOMAIN
  || '';
process.env.SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN
  || process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN
  || process.env.VITE_SHOPIFY_ADMIN_API_TOKEN
  || '';
process.env.SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET
  || process.env.VITE_SHOPIFY_WEBHOOK_SECRET
  || process.env.VITE_SHOPIFY_CLIENT_SECRET
  || '';
process.env.SHOPIFY_WEBHOOK_BASE_URL = process.env.SHOPIFY_WEBHOOK_BASE_URL
  || process.env.VITE_SHOPIFY_WEBHOOK_BASE_URL
  || '';

async function main(): Promise<void> {
  const result = await ensureRequiredWebhookSubscriptions();

  console.log(JSON.stringify({
    created: result.created,
    existing: result.existing,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});