import dotenv from 'dotenv';
import { deleteWebhookSubscription } from '../aws/src/providers/ebay/client.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.EBAY_ENV = process.env.EBAY_ENV
  || process.env.VITE_EBAY_ENV
  || '';
process.env.EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID
  || process.env.VITE_EBAY_CLIENT_ID
  || '';
process.env.EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET
  || process.env.VITE_EBAY_CLIENT_SECRET
  || '';
process.env.EBAY_REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN
  || process.env.VITE_EBAY_REFRESH_TOKEN
  || '';

function getWebhookSubscriptionIds(): string[] {
  const cliIds = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
  if (cliIds.length > 0) {
    return cliIds;
  }

  const fromEnv = (process.env.EBAY_WEBHOOK_SUBSCRIPTION_IDS || process.env.VITE_EBAY_WEBHOOK_SUBSCRIPTION_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) {
    return fromEnv;
  }

  const single = (process.env.EBAY_WEBHOOK_SUBSCRIPTION_ID || process.env.VITE_EBAY_WEBHOOK_SUBSCRIPTION_ID || '').trim();
  return single ? [single] : [];
}

async function main(): Promise<void> {
  const subscriptionIds = getWebhookSubscriptionIds();
  if (subscriptionIds.length === 0) {
    throw new Error('Provide EBAY_WEBHOOK_SUBSCRIPTION_ID or EBAY_WEBHOOK_SUBSCRIPTION_IDS, or pass ids as CLI args.');
  }

  for (const subscriptionId of subscriptionIds) {
    await deleteWebhookSubscription(subscriptionId);
  }

  console.log(JSON.stringify({ deleted: subscriptionIds }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});