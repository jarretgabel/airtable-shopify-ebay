// Side-effect-free check of the deployed Shopify webhook: sends a fake paid order for a product that does not exist,
// signed with the webhook secret. 200 means the deployed secret matches (the event is reported unmatched and nothing
// is written); 401 means the deployed secret differs from the one in .env.local.
import { createHmac, randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.VITE_SHOPIFY_WEBHOOK_SECRET || process.env.VITE_SHOPIFY_CLIENT_SECRET || '';
const base = (process.env.SHOPIFY_WEBHOOK_BASE_URL || process.env.VITE_SHOPIFY_WEBHOOK_BASE_URL || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
if (!secret || !base) {
  console.error('Missing the Shopify webhook secret or base URL in .env.local.');
  process.exit(1);
}

const body = JSON.stringify({
  id: 999999999990001, name: '#PROBE-NOT-REAL', financial_status: 'paid', cancelled_at: null,
  line_items: [{ id: 1, product_id: 1, variant_id: 1, quantity: 1 }],
});
const signature = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
const send = async (label, hmac) => {
  const response = await fetch(`${base}/api/hooks/shopify/orders-paid`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-shopify-hmac-sha256': hmac, 'x-shopify-topic': 'orders/updated', 'x-shopify-webhook-id': randomUUID() },
    body,
  });
  console.log(`${label}: HTTP ${response.status} ${(await response.text()).slice(0, 160)}`);
};
await send('correctly signed', signature);
await send('wrongly signed  ', Buffer.from('wrong').toString('base64'));
