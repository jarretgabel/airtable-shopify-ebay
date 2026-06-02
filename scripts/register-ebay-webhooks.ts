import dotenv from 'dotenv';
import {
  getEbayWebhookEventTypes,
  getRequiredEbayWebhookCallbackUrl,
  registerWebhookSubscription,
} from '../aws/src/providers/ebay/client.js';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

process.env.EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID
  || process.env.VITE_EBAY_CLIENT_ID
  || '';
process.env.EBAY_CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET
  || process.env.VITE_EBAY_CLIENT_SECRET
  || '';
process.env.EBAY_REFRESH_TOKEN = process.env.EBAY_REFRESH_TOKEN
  || process.env.VITE_EBAY_REFRESH_TOKEN
  || '';
process.env.EBAY_ENV = process.env.EBAY_ENV
  || process.env.VITE_EBAY_ENV
  || '';
process.env.EBAY_WEBHOOK_BASE_URL = process.env.EBAY_WEBHOOK_BASE_URL
  || process.env.VITE_EBAY_WEBHOOK_BASE_URL
  || '';
process.env.EBAY_WEBHOOK_SUBSCRIPTION_PATH = process.env.EBAY_WEBHOOK_SUBSCRIPTION_PATH
  || process.env.VITE_EBAY_WEBHOOK_SUBSCRIPTION_PATH
  || '';
process.env.EBAY_WEBHOOK_EVENT_TYPES = process.env.EBAY_WEBHOOK_EVENT_TYPES
  || process.env.VITE_EBAY_WEBHOOK_EVENT_TYPES
  || '';
process.env.EBAY_WEBHOOK_REQUEST_BODY_JSON = process.env.EBAY_WEBHOOK_REQUEST_BODY_JSON
  || process.env.VITE_EBAY_WEBHOOK_REQUEST_BODY_JSON
  || '';

async function main(): Promise<void> {
  const callbackUrl = getRequiredEbayWebhookCallbackUrl();
  const eventTypes = getEbayWebhookEventTypes();

  const result = await registerWebhookSubscription({
    callbackUrl,
    eventTypes,
  });

  console.log(JSON.stringify({
    id: result.id,
    callbackUrl: result.callbackUrl,
    eventTypes: result.eventTypes,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});