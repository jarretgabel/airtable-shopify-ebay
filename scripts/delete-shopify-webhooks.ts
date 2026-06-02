import dotenv from 'dotenv';
import {
  deleteWebhookSubscription,
  getRequiredShopifyWebhookCallbackUrl,
  getRequiredShopifyWebhookSubscriptions,
  listWebhookSubscriptions,
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

async function main(): Promise<void> {
  const requiredSubscriptions = getRequiredShopifyWebhookSubscriptions();
  const existingSubscriptions = await listWebhookSubscriptions();
  const deleted: Array<{ id: string; topic: string; callbackUrl: string }> = [];

  for (const subscription of requiredSubscriptions) {
    const callbackUrl = getRequiredShopifyWebhookCallbackUrl(subscription.topic);
    const match = existingSubscriptions.find((item) => item.topic === subscription.topic && item.callbackUrl === callbackUrl);
    if (!match) {
      continue;
    }

    await deleteWebhookSubscription(match.id);
    deleted.push(match);
  }

  console.log(JSON.stringify({
    deleted,
    requiredCount: requiredSubscriptions.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});