import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createHandler as createShopifyHandler } from '../../../../../aws/src/handlers/shopify/receiveWebhook.js';
import { createHandler as createEbayListingHandler } from '../../../../../aws/src/handlers/ebay/receiveWebhook.js';
import { createHandler as createEbayNotificationHandler } from '../../../../../aws/src/handlers/ebay/receiveNotification.js';
import { closeEbayListingWhenSoldOnShopify, retainShopifyProductWhenSoldOnEbay, retainShopifyProductWhenSoldOnShopify } from '../../../../../aws/src/services/crossChannelClose.js';
import { retainSoldShopifyProduct, type SoldRetentionDependencies } from '../../../../../aws/src/services/soldRetention.js';
import type { ShopifyProductSaleState } from '../../../../../aws/src/providers/shopify/client.js';

// Replays recorded-style Shopify and eBay payloads through the real handlers and services against an in-memory
// Airtable, Shopify store and eBay API, so the whole chain (match, side effects, retries, idempotency) is exercised
// with no network and no live data.

type Fields = Record<string, unknown>;

class World {
  records = new Map<string, Fields>();
  product: ShopifyProductSaleState | null = null;
  ebayOffers = new Map<string, string>();
  ebayCalls: string[] = [];
  failShopifyTag: 'never' | 'once' | 'always' = 'never';
  failEbayWithdraw = false;
  shopifyWrites: string[] = [];

  list = async () => [...this.records].map(([id, fields]) => ({ id, createdTime: 'now', fields: structuredClone(fields) })) as never;
  update = async (_source: string, id: string, fields: Fields) => {
    this.records.set(id, { ...(this.records.get(id) ?? {}), ...fields });
    return { id, createdTime: 'now', fields: this.records.get(id)! } as never;
  };

  shopify: SoldRetentionDependencies = {
    getProductSaleState: async () => (this.product ? structuredClone(this.product) : null),
    syncProductVariantInventoryLevels: async () => {
      this.shopifyWrites.push('zero');
      if (this.product) {
        this.product.totalInventory = 0;
        this.product.variants.forEach((variant) => { variant.inventoryQuantity = 0; });
      }
    },
    denyVariantOversell: async () => {
      this.shopifyWrites.push('deny');
      this.product?.variants.forEach((variant) => { variant.inventoryPolicy = 'DENY'; });
    },
    addProductTags: async (_id, tags) => {
      if (this.failShopifyTag === 'always' || this.failShopifyTag === 'once') {
        if (this.failShopifyTag === 'once') this.failShopifyTag = 'never';
        throw Object.assign(new Error('Shopify is unavailable'), { retryable: true });
      }
      this.shopifyWrites.push('tag');
      if (this.product) this.product.tags = [...this.product.tags, ...tags];
    },
  };

  retainOnShopify = (recordId: string, fields: Fields, options?: { productIdHint?: string }) =>
    retainShopifyProductWhenSoldOnShopify(recordId, fields, { updateRecord: this.update as never, retainShopifyProduct: (input) => retainSoldShopifyProduct(input, this.shopify), ...options });
  retainOnEbay = (recordId: string, fields: Fields, options?: { productIdHint?: string }) =>
    retainShopifyProductWhenSoldOnEbay(recordId, fields, { updateRecord: this.update as never, retainShopifyProduct: (input) => retainSoldShopifyProduct(input, this.shopify), ...options });
  closeEbay = (recordId: string, fields: Fields) => closeEbayListingWhenSoldOnShopify(recordId, fields, { updateRecord: this.update as never });
}

let world: World;
const savedFetch = global.fetch;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  world = new World();
  for (const [key, value] of Object.entries({ EBAY_ENV: 'production', EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret', EBAY_REFRESH_TOKEN: 'refresh' })) {
    savedEnv.set(key, process.env[key]);
    process.env[key] = value;
  }
  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/identity/v1/oauth2/token')) return new Response(JSON.stringify({ access_token: 't', expires_in: 7200 }), { status: 200 });
    const withdraw = url.match(/\/sell\/inventory\/v1\/offer\/([^/]+)\/withdraw$/);
    if (withdraw && init?.method === 'POST') {
      world.ebayCalls.push(`withdraw:${withdraw[1]}`);
      if (world.failEbayWithdraw) return new Response('unavailable', { status: 503 });
      world.ebayOffers.set(withdraw[1], 'WITHDRAWN');
      return new Response('{}', { status: 200 });
    }
    throw new Error(`Unexpected request in replay: ${init?.method ?? 'GET'} ${url}`);
  };
});

afterEach(() => {
  global.fetch = savedFetch;
  for (const [key, value] of savedEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

const SECRET = 'replay-secret';
const PRODUCT_ID = 555;

function seed(overrides: Fields = {}, product: Partial<ShopifyProductSaleState> = {}) {
  world.records.set('rec-1', {
    'Workflow Status': 'Listed, Shopify', SKU: 'SKU-1', 'Shopify REST Product ID': String(PRODUCT_ID),
    'eBay Offer ID': 'offer-1', 'eBay Listing ID': '1234567', 'Shopify Price': 3500, ...overrides,
  });
  world.ebayOffers.set('offer-1', 'PUBLISHED');
  world.product = {
    id: PRODUCT_ID, status: 'ACTIVE', tags: ['Amplifier', 'Pre-Owned Hifi'], totalInventory: 1, variantsTruncated: false,
    variants: [{ id: 'gid://shopify/ProductVariant/1', sku: 'SKU-1', position: 1, inventoryPolicy: 'CONTINUE', inventoryQuantity: 1, tracked: true }],
    ...product,
  };
}

function shopifyEvent(path: string, header: string, body: Fields, eventId: string): APIGatewayProxyEventV2 {
  const raw = JSON.stringify(body);
  return {
    version: '2.0', routeKey: 'POST /api/hooks/shopify/{topic}', rawPath: `/api/hooks/shopify/${path}`, rawQueryString: '',
    headers: { 'content-type': 'application/json', 'x-shopify-topic': header, 'x-shopify-shop-domain': 's.myshopify.com', 'x-shopify-event-id': eventId, 'x-shopify-webhook-id': eventId, 'x-shopify-hmac-sha256': createHmac('sha256', SECRET).update(raw, 'utf8').digest('base64') },
    pathParameters: { topic: path },
    requestContext: { accountId: 't', apiId: 't', domainName: 'l', domainPrefix: 'l', http: { method: 'POST', path: `/api/hooks/shopify/${path}`, protocol: 'HTTP/1.1', sourceIp: '1.1.1.1', userAgent: 't' }, requestId: 'r', routeKey: 'k', stage: '$default', time: 'n', timeEpoch: 0 },
    body: raw, isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

const shopifyHandler = () => createShopifyHandler({
  getWebhookSecret: () => SECRET,
  getConfiguredRecords: world.list,
  updateConfiguredRecord: world.update as never,
  closeEbayListingWhenSoldOnShopify: world.closeEbay,
  retainShopifyProductWhenSoldOnShopify: world.retainOnShopify,
});

const paidOrder = { id: 9001, order_id: 9001, name: '#1042', processed_at: '2026-10-17T12:00:00Z', financial_status: 'paid', line_items: [{ product_id: PRODUCT_ID }] };
const send = async (handler: (e: APIGatewayProxyEventV2) => Promise<unknown>, event: APIGatewayProxyEventV2) => (await handler(event)) as { statusCode: number; body: string };
const record = () => world.records.get('rec-1')!;
const soldArchived = () => world.product!.tags.includes('sold-archive') && world.product!.totalInventory === 0 && world.product!.variants.every((v) => v.inventoryPolicy === 'DENY');

function ebayHandler() {
  const listing = createEbayListingHandler({
    getWebhookSecret: () => undefined,
    getConfiguredRecords: world.list,
    updateConfiguredRecord: world.update as never,
    retainShopifyProductWhenSoldOnEbay: world.retainOnEbay,
  });
  return createEbayNotificationHandler({
    verifySignature: async () => undefined,
    getOrderLineItems: async () => [],
    processEvent: async (payload) => {
      const result = await listing({ version: '2.0', routeKey: 'k', rawPath: '/x', rawQueryString: '', headers: { 'content-type': 'application/json' }, requestContext: { http: { method: 'POST', path: '/x' } }, isBase64Encoded: false, body: JSON.stringify(payload) } as unknown as APIGatewayProxyEventV2) as { statusCode?: number };
      return { statusCode: result.statusCode ?? 200 };
    },
  });
}

const ebayEvent = (topic: string, data: Fields, notificationId: string, eventDate = '2026-10-17T13:00:00.000Z'): APIGatewayProxyEventV2 => ({
  version: '2.0', routeKey: 'k', rawPath: '/api/hooks/ebay/notifications', rawQueryString: '', headers: { 'content-type': 'application/json', 'x-ebay-signature': 'sig' },
  requestContext: { http: { method: 'POST', path: '/api/hooks/ebay/notifications' } }, isBase64Encoded: false,
  body: JSON.stringify({ metadata: { topic }, notification: { notificationId, eventDate, data } }),
} as unknown as APIGatewayProxyEventV2);
const ebayOrder = (listingId = '1234567') => ({ order: { orderId: '12-34567-89012', orderLineItems: [{ listingId, orderLineItemId: 'li-1', quantity: 1 }] } });

test('a Shopify sale is matched to the record, withdraws the eBay offer and archives the Shopify product', async () => {
  seed({}, { totalInventory: 0, variants: [{ id: 'v', sku: 'SKU-1', position: 1, inventoryPolicy: 'CONTINUE', inventoryQuantity: 0, tracked: true }] });
  const response = await send(shopifyHandler(), shopifyEvent('orders-paid', 'orders/updated', paidOrder, 'evt-1'));

  assert.equal(response.statusCode, 200);
  assert.notEqual(JSON.parse(response.body).unmatched, true, 'the sale must be matched to the Airtable record');
  assert.deepEqual(world.ebayCalls, ['withdraw:offer-1']);
  assert.equal(world.ebayOffers.get('offer-1'), 'WITHDRAWN');
  assert.ok(soldArchived(), 'Shopify product must be sold-archive tagged, at zero stock and not oversellable');
  assert.ok(record()['eBay Closed At'] && record()['Shopify Closed At']);
  assert.deepEqual(world.product!.tags.filter((tag) => tag !== 'sold-archive'), ['Amplifier', 'Pre-Owned Hifi'], 'existing tags are kept');
});

test('redelivering the same Shopify event does not repeat any side effect', async () => {
  seed({}, { totalInventory: 0 });
  const handler = shopifyHandler();
  await send(handler, shopifyEvent('orders-paid', 'orders/updated', paidOrder, 'evt-1'));
  const afterFirst = { calls: [...world.ebayCalls], writes: [...world.shopifyWrites] };
  assert.deepEqual(afterFirst, { calls: ['withdraw:offer-1'], writes: ['deny', 'tag'] }, 'the first delivery must do the work');
  const second = await send(handler, shopifyEvent('orders-paid', 'orders/updated', paidOrder, 'evt-1'));

  assert.equal(second.statusCode, 200);
  assert.deepEqual({ calls: world.ebayCalls, writes: world.shopifyWrites }, afterFirst);
});

test('a temporary Shopify failure answers 503, records nothing, and the redelivery finishes the job', async () => {
  seed({}, { totalInventory: 0 });
  world.failShopifyTag = 'once';
  const handler = shopifyHandler();

  const first = await send(handler, shopifyEvent('orders-paid', 'orders/updated', paidOrder, 'evt-1'));
  assert.equal(first.statusCode, 503);
  assert.equal(record()['Shopify Last Webhook Event ID'], undefined, 'the event must not be marked processed');
  assert.ok(!world.product!.tags.includes('sold-archive'));

  const second = await send(handler, shopifyEvent('orders-paid', 'orders/updated', paidOrder, 'evt-1'));
  assert.equal(second.statusCode, 200);
  assert.ok(soldArchived());
  assert.equal(world.ebayCalls.filter((call) => call === 'withdraw:offer-1').length >= 1, true);
});

test('a Shopify cancellation, refund and return record the outcome and never change the product or eBay', async () => {
  seed({ 'Shopify Order ID': '9001' }, { totalInventory: 0 });
  const handler = shopifyHandler();

  await send(handler, shopifyEvent('orders-cancelled', 'orders/updated', { ...paidOrder, cancelled_at: '2026-10-18T09:00:00Z' }, 'evt-cancel'));
  assert.equal(record()['Post-Sale Outcome'], 'Cancelled');

  seed({ 'Shopify Order ID': '9001', 'Paid Amount': 3500 }, { totalInventory: 0 });
  await send(handler, shopifyEvent('refunds-create', 'refunds/create', { id: 77, order_id: 9001, note: 'Buyer remorse', transactions: [{ kind: 'refund', status: 'success', amount: '500.00' }] }, 'evt-refund'));
  assert.equal(record()['Post-Sale Outcome'], 'Partial Refund');
  assert.equal(record()['Refund Amount'], 500);

  seed({ 'Shopify Order ID': '9001' }, { totalInventory: 0 });
  await send(handler, shopifyEvent('returns-process', 'returns/approve', { id: 88, order_id: 9001, order: { id: 9001 }, line_items: [{ product_id: PRODUCT_ID }] }, 'evt-return'));
  assert.equal(record()['Post-Sale Outcome'], 'Returned');

  assert.deepEqual(world.ebayCalls, [], 'no eBay call for cancel/refund/return');
  assert.deepEqual(world.shopifyWrites, [], 'no stock, tag or overselling change for cancel/refund/return');
});

test('a Shopify sale for an unknown product changes nothing and is acknowledged', async () => {
  seed({}, { totalInventory: 0 });
  const response = await send(shopifyHandler(), shopifyEvent('orders-paid', 'orders/updated', { ...paidOrder, line_items: [{ product_id: 42 }] }, 'evt-x'));
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).unmatched, true);
  assert.deepEqual([world.ebayCalls, world.shopifyWrites], [[], []]);
});

test('an eBay sale (real notification shape) zeroes the Shopify stock, tags it, and records the event once', async () => {
  seed({ 'eBay Closed At': '' });
  const handler = ebayHandler();
  const first = await send(handler, ebayEvent('ORDER_CONFIRMATION', ebayOrder(), 'n-1'));

  assert.equal(first.statusCode, 200);
  assert.ok(soldArchived());
  assert.equal(record()['eBay Last Webhook Event'], 'order.created');
  assert.ok(record()['Shopify Closed At']);

  const writes = [...world.shopifyWrites];
  const again = await send(handler, ebayEvent('ORDER_CONFIRMATION', ebayOrder(), 'n-1'));
  assert.equal(again.statusCode, 200);
  assert.deepEqual(world.shopifyWrites, writes, 'a redelivered notification repeats nothing');
});

test('a temporary Shopify failure during an eBay sale answers 503 and the redelivery completes it', async () => {
  seed();
  world.failShopifyTag = 'once';
  const handler = ebayHandler();

  assert.equal((await send(handler, ebayEvent('ORDER_CONFIRMATION', ebayOrder(), 'n-1'))).statusCode, 503);
  assert.equal(record()['eBay Last Webhook Event'], undefined, 'not marked processed after a retryable failure');
  assert.equal((await send(handler, ebayEvent('ORDER_CONFIRMATION', ebayOrder(), 'n-1'))).statusCode, 200);
  assert.ok(soldArchived());
});

test('an eBay sale for a listing that is not in Airtable changes nothing', async () => {
  seed();
  const response = await send(ebayHandler(), ebayEvent('ORDER_CONFIRMATION', ebayOrder('999'), 'n-2'));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(world.shopifyWrites, []);
  assert.ok(!soldArchived());
});

test('an eBay sale of a multi-unit Shopify product is flagged for review and the product is left alone', async () => {
  seed({}, { totalInventory: 2, variants: [{ id: 'v', sku: 'SKU-1', position: 1, inventoryPolicy: 'CONTINUE', inventoryQuantity: 2, tracked: true }] });
  await send(ebayHandler(), ebayEvent('ORDER_CONFIRMATION', ebayOrder(), 'n-3'));
  assert.deepEqual(world.shopifyWrites, []);
  assert.match(String(record()['Shopify Close Result']), /review/i);
});

test('known gap: eBay cancellation and return notifications are acknowledged but change nothing yet', async () => {
  seed({ 'eBay Closed At': '2026-10-17T00:00:00.000Z' }, { totalInventory: 0 });
  const handler = ebayHandler();
  for (const topic of ['ORDER_CANCELLATION_ACTIVITY', 'ORDER_RETURN_ACTIVITY']) {
    const response = await send(handler, ebayEvent(topic, { activityType: 'X' }, `n-${topic}`));
    assert.equal(response.statusCode, 200);
  }
  assert.equal(record()['Post-Sale Outcome'], undefined);
  assert.deepEqual(world.shopifyWrites, []);
});
