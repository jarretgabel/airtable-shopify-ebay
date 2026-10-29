import { sendPlainTextEmail } from '../providers/gmail/client.js';
import { getOptionalSecret } from '../shared/secrets.js';
import { logError } from '../shared/logging.js';

export interface SaleAlert {
  channel: 'Shopify' | 'eBay';
  action: string;
  recordId?: string;
  fields?: Record<string, unknown>;
  orderId?: string;
  orderName?: string;
  ebayListingId?: string;
  shopifyProductId?: string;
  results?: string[];
  note?: string;
}

function text(fields: Record<string, unknown> | undefined, names: string[]): string {
  for (const name of names) {
    const value = fields?.[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function shopifyId(raw: string): string {
  return raw.split('/').pop()?.trim() ?? '';
}

export function buildSaleAlertEmail(alert: SaleAlert, env: { appBaseUrl: string; shopDomain: string }): { subject: string; body: string } {
  const title = text(alert.fields, ['Item Title', 'Title']) || '(unmatched listing)';
  const sku = text(alert.fields, ['SKU', 'eBay Inventory SKU']);
  const ebayId = alert.ebayListingId || text(alert.fields, ['eBay Listing ID', 'eBay Item ID']);
  const productId = shopifyId(alert.shopifyProductId || text(alert.fields, ['Shopify REST Product ID']));
  const orderRef = alert.orderName || alert.orderId || '';
  const shop = env.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const base = env.appBaseUrl.replace(/\/+$/, '');

  const lines = [
    `Channel: ${alert.channel}`,
    `Action: ${alert.action}`,
    `Listing: ${title}`,
    ...(sku ? [`SKU: ${sku}`] : []),
    ...(orderRef ? [`Order: ${orderRef}`] : []),
    ...(alert.results?.length ? ['', 'Result:', ...alert.results.map((line) => `- ${line}`)] : []),
    ...(alert.note ? ['', alert.note] : []),
    '',
    'Links:',
    ...(alert.recordId && base ? [`- App listing: ${base}/listings/${alert.recordId}`] : []),
    ...(ebayId ? [`- eBay listing: https://www.ebay.com/itm/${ebayId}`] : []),
    ...(productId && shop ? [`- Shopify product: https://${shop}/admin/products/${productId}`] : []),
    ...(alert.channel === 'Shopify' && alert.orderId && shop ? [`- Shopify order: https://${shop}/admin/orders/${shopifyId(alert.orderId)}`] : []),
  ];

  return { subject: `[${alert.channel}] ${alert.action}: ${title}`, body: lines.join('\n') };
}

// Best effort: an alert failure must never fail or retry the webhook.
export async function sendSaleAlert(alert: SaleAlert): Promise<void> {
  const recipients = getOptionalSecret('SALE_ALERT_EMAIL');
  if (!recipients) return;
  try {
    const { subject, body } = buildSaleAlertEmail(alert, {
      appBaseUrl: getOptionalSecret('APP_BASE_URL') ?? '',
      shopDomain: getOptionalSecret('SHOPIFY_STORE_DOMAIN') ?? '',
    });
    await sendPlainTextEmail(recipients, subject, body);
  } catch (error) {
    logError('Sale alert email failed', error);
  }
}
