import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteWebhookSubscription,
  ensureRequiredWebhookSubscriptions,
  getRequiredShopifyWebhookCallbackUrl,
  listWebhookSubscriptions,
} from '../../../../../../aws/src/providers/shopify/client.js';

test('getRequiredShopifyWebhookCallbackUrl builds HTTPS callback URLs from env config', () => {
  const originalBaseUrl = process.env.SHOPIFY_WEBHOOK_BASE_URL;

  process.env.SHOPIFY_WEBHOOK_BASE_URL = 'https://example.com/';

  try {
    assert.equal(getRequiredShopifyWebhookCallbackUrl('ORDERS_PAID'), 'https://example.com/api/hooks/shopify/orders-paid');
    assert.equal(getRequiredShopifyWebhookCallbackUrl('ORDERS_CANCELLED'), 'https://example.com/api/hooks/shopify/orders-cancelled');
    assert.equal(getRequiredShopifyWebhookCallbackUrl('REFUNDS_CREATE'), 'https://example.com/api/hooks/shopify/refunds-create');
  } finally {
    process.env.SHOPIFY_WEBHOOK_BASE_URL = originalBaseUrl;
  }
});

test('listWebhookSubscriptions returns normalized HTTP webhook subscriptions', async () => {
  const originalFetch = globalThis.fetch;
  const originalStoreDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const originalAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'token';

  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      webhookSubscriptions: {
        edges: [
          {
            node: {
              id: 'gid://shopify/WebhookSubscription/1',
              topic: 'ORDERS_PAID',
              endpoint: {
                __typename: 'WebhookHttpEndpoint',
                callbackUrl: 'https://example.com/api/hooks/shopify/orders-paid',
              },
            },
          },
        ],
      },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  try {
    const result = await listWebhookSubscriptions();
    assert.deepEqual(result, [{
      id: 'gid://shopify/WebhookSubscription/1',
      topic: 'ORDERS_PAID',
      callbackUrl: 'https://example.com/api/hooks/shopify/orders-paid',
    }]);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.SHOPIFY_STORE_DOMAIN = originalStoreDomain;
    process.env.SHOPIFY_ACCESS_TOKEN = originalAccessToken;
  }
});

test('ensureRequiredWebhookSubscriptions creates only missing required subscriptions', async () => {
  const originalFetch = globalThis.fetch;
  const originalStoreDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const originalAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const originalBaseUrl = process.env.SHOPIFY_WEBHOOK_BASE_URL;
  const requests: Array<{ query: string; variables?: Record<string, unknown> }> = [];

  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'token';
  process.env.SHOPIFY_WEBHOOK_BASE_URL = 'https://example.com';

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> };
    requests.push({ query: payload.query ?? '', variables: payload.variables });

    if (payload.query?.includes('query ListWebhookSubscriptions')) {
      return new Response(JSON.stringify({
        data: {
          webhookSubscriptions: {
            edges: [
              {
                node: {
                  id: 'gid://shopify/WebhookSubscription/1',
                  topic: 'ORDERS_PAID',
                  endpoint: {
                    __typename: 'WebhookHttpEndpoint',
                    callbackUrl: 'https://example.com/api/hooks/shopify/orders-paid',
                  },
                },
              },
            ],
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (payload.query?.includes('mutation RegisterWebhookSubscription')) {
      const topic = String(payload.variables?.topic ?? '');
      const callbackUrl = String(payload.variables?.callbackUrl ?? '');
      return new Response(JSON.stringify({
        data: {
          webhookSubscriptionCreate: {
            webhookSubscription: {
              id: `gid://shopify/WebhookSubscription/${topic}`,
              topic,
              endpoint: {
                __typename: 'WebhookHttpEndpoint',
                callbackUrl,
              },
            },
            userErrors: [],
          },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    throw new Error(`Unexpected fetch call: ${payload.query}`);
  };

  try {
    const result = await ensureRequiredWebhookSubscriptions();
    assert.deepEqual(result.existing, [{
      id: 'gid://shopify/WebhookSubscription/1',
      topic: 'ORDERS_PAID',
      callbackUrl: 'https://example.com/api/hooks/shopify/orders-paid',
    }]);
    assert.equal(result.created.length, 5);
    assert.deepEqual(result.created.map((item) => item.topic).sort(), [
      'DISPUTES_CREATE',
      'DISPUTES_UPDATE',
      'ORDERS_CANCELLED',
      'REFUNDS_CREATE',
      'RETURNS_PROCESS',
    ]);
    assert.equal(requests.filter((request) => request.query.includes('mutation RegisterWebhookSubscription')).length, 5);
  } finally {
    globalThis.fetch = originalFetch;
    process.env.SHOPIFY_STORE_DOMAIN = originalStoreDomain;
    process.env.SHOPIFY_ACCESS_TOKEN = originalAccessToken;
    process.env.SHOPIFY_WEBHOOK_BASE_URL = originalBaseUrl;
  }
});

test('deleteWebhookSubscription sends the expected GraphQL mutation', async () => {
  const originalFetch = globalThis.fetch;
  const originalStoreDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const originalAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  process.env.SHOPIFY_STORE_DOMAIN = 'test-shop.myshopify.com';
  process.env.SHOPIFY_ACCESS_TOKEN = 'token';

  globalThis.fetch = async (_input, init) => {
    const payload = JSON.parse(String(init?.body ?? '{}')) as { query?: string; variables?: Record<string, unknown> };

    assert.match(payload.query ?? '', /mutation DeleteWebhookSubscription/);
    assert.equal(payload.variables?.id, 'gid://shopify/WebhookSubscription/1');

    return new Response(JSON.stringify({
      data: {
        webhookSubscriptionDelete: {
          deletedWebhookSubscriptionId: 'gid://shopify/WebhookSubscription/1',
          userErrors: [],
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await deleteWebhookSubscription('gid://shopify/WebhookSubscription/1');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.SHOPIFY_STORE_DOMAIN = originalStoreDomain;
    process.env.SHOPIFY_ACCESS_TOKEN = originalAccessToken;
  }
});