import dotenv from 'dotenv';
import {
  ensureRequiredWebhookSubscriptions,
  getCurrentShopifyAccessScopes,
  getRequiredShopifyWebhookSubscriptions,
} from '../aws/src/providers/shopify/client.js';

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

const MANUAL_ONLY_SCOPES = [
  'read_orders',
  'read_all_orders',
  'read_returns',
  'read_shopify_payments_disputes',
] as const;

async function main(): Promise<void> {
  const accessScopes = new Set(await getCurrentShopifyAccessScopes());
  const missingScopes = MANUAL_ONLY_SCOPES.filter((scope) => !accessScopes.has(scope));

  if (missingScopes.length > 0) {
    console.log(JSON.stringify({
      created: [],
      existing: [],
      manual: getRequiredShopifyWebhookSubscriptions().map((subscription) => ({
        key: subscription.key,
        topic: subscription.topic,
        callbackPath: subscription.callbackPath,
      })),
      missingScopes,
      note: 'Automatic webhook registration is skipped until the app token includes the missing scopes.',
    }, null, 2));
    return;
  }

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