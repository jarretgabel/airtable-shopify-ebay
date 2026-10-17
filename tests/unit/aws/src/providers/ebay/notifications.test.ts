import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotificationDestination,
  createNotificationSubscription,
  getNotificationPublicKey,
  getNotificationTopicSchemaVersion,
  getOrderLineItems,
  listNotificationDestinations,
  listNotificationSubscriptions,
  probeNotificationAccess,
  testNotificationSubscription,
} from '../../../../../../aws/src/providers/ebay/client.js';

interface Call { method: string; url: string; auth: string; body: Record<string, unknown> | null }

async function withMockedEbay(
  routes: (call: Call) => Response | undefined,
  run: (calls: Call[]) => Promise<void>,
): Promise<void> {
  const originalFetch = global.fetch;
  const saved = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries({
    EBAY_ENV: 'production',
    EBAY_CLIENT_ID: 'id',
    EBAY_CLIENT_SECRET: 'secret',
    EBAY_REFRESH_TOKEN: 'refresh',
  })) {
    saved.set(key, process.env[key]);
    process.env[key] = value;
  }

  const calls: Call[] = [];
  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/identity/v1/oauth2/token')) {
      const grant = new URLSearchParams(String(init?.body)).get('grant_type');
      return new Response(JSON.stringify({ access_token: grant === 'refresh_token' ? 'USER-TOKEN' : 'APP-TOKEN', expires_in: 7200 }), { status: 200 });
    }

    const headers = init?.headers as Record<string, string> | undefined;
    const call: Call = {
      method: init?.method ?? 'GET',
      url,
      auth: headers?.Authorization ?? '',
      body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null,
    };
    calls.push(call);
    const response = routes(call);
    if (!response) {
      throw new Error(`Unexpected eBay call: ${call.method} ${url}`);
    }
    return response;
  };

  try {
    await run(calls);
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

test('destinations are created and listed with the application token', async () => {
  await withMockedEbay((call) => {
    if (call.method === 'POST' && call.url.endsWith('/commerce/notification/v1/destination')) {
      return new Response(null, { status: 201, headers: { Location: 'https://api.ebay.com/commerce/notification/v1/destination/dest-77' } });
    }
    if (call.method === 'GET' && call.url.includes('/commerce/notification/v1/destination')) {
      return json({ destinations: [{ destinationId: 'dest-77', status: 'ENABLED', deliveryConfig: { endpoint: 'https://h.example/x' } }] });
    }
    return undefined;
  }, async (calls) => {
    const id = await createNotificationDestination({ name: 'n', endpoint: 'https://h.example/x', verificationToken: 'v'.repeat(40) });
    assert.equal(id, 'dest-77');
    assert.deepEqual(calls[0].body, {
      name: 'n',
      status: 'ENABLED',
      deliveryConfig: { endpoint: 'https://h.example/x', verificationToken: 'v'.repeat(40) },
    });
    assert.equal(calls[0].auth, 'Bearer APP-TOKEN');

    assert.deepEqual(await listNotificationDestinations(), [{ destinationId: 'dest-77', endpoint: 'https://h.example/x', status: 'ENABLED' }]);
  });
});

test('subscriptions use the user token, carry the topic schema, and are listed', async () => {
  await withMockedEbay((call) => {
    if (call.method === 'GET' && call.url.includes('/topic/ORDER_CONFIRMATION')) {
      return json({ supportedPayloads: [{ deliveryProtocol: 'HTTPS', format: ['JSON'], schemaVersion: '1.0' }] });
    }
    if (call.method === 'POST' && call.url.endsWith('/commerce/notification/v1/subscription')) {
      return new Response(null, { status: 201, headers: { Location: 'https://api.ebay.com/commerce/notification/v1/subscription/sub-5' } });
    }
    if (call.method === 'GET' && call.url.includes('/commerce/notification/v1/subscription')) {
      return json({ subscriptions: [{ subscriptionId: 'sub-5', topicId: 'ORDER_CONFIRMATION', destinationId: 'dest-77', status: 'ENABLED' }] });
    }
    return undefined;
  }, async (calls) => {
    assert.equal(await getNotificationTopicSchemaVersion('ORDER_CONFIRMATION'), '1.0');
    const id = await createNotificationSubscription({ destinationId: 'dest-77', topicId: 'ORDER_CONFIRMATION', schemaVersion: '1.0' });
    assert.equal(id, 'sub-5');
    const create = calls.find((c) => c.method === 'POST')!;
    assert.deepEqual(create.body, {
      topicId: 'ORDER_CONFIRMATION',
      status: 'ENABLED',
      destinationId: 'dest-77',
      payload: { format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' },
    });
    assert.equal(create.auth, 'Bearer USER-TOKEN');
    assert.equal((await listNotificationSubscriptions())[0].subscriptionId, 'sub-5');
  });
});

test('eBay rejections surface the status, and a missing topic schema is an error', async () => {
  await withMockedEbay((call) => {
    if (call.method === 'POST') return json({ errors: [{ errorId: 195011 }] }, 403);
    if (call.url.includes('/topic/')) return json({ supportedPayloads: [] });
    return undefined;
  }, async () => {
    await assert.rejects(
      createNotificationSubscription({ destinationId: 'd', topicId: 'T', schemaVersion: '1' }),
      (error: { statusCode?: number; message?: string }) => error.statusCode === 403 && /195011/.test(error.message ?? ''),
    );
    await assert.rejects(getNotificationTopicSchemaVersion('T'), /no HTTPS\/JSON payload schema/);
  });
});

test('the notification public key is fetched with the application token and cached', async () => {
  await withMockedEbay((call) => {
    if (call.url.includes('/public_key/kid-9')) return json({ key: 'MFkw', algorithm: 'ECDSA', digest: 'SHA1' });
    return undefined;
  }, async (calls) => {
    assert.deepEqual(await getNotificationPublicKey('kid-9'), { key: 'MFkw', algorithm: 'ECDSA', digest: 'SHA1' });
    await getNotificationPublicKey('kid-9');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].auth, 'Bearer APP-TOKEN');
  });
});

test('order line items are read from the Fulfillment API with the user token', async () => {
  await withMockedEbay((call) => {
    if (call.url.includes('/sell/fulfillment/v1/order/12-34')) {
      return json({ lineItems: [{ legacyItemId: '111', sku: 'S1' }, { legacyItemId: '222' }] });
    }
    return undefined;
  }, async (calls) => {
    assert.deepEqual(await getOrderLineItems('12-34'), [
      { legacyItemId: '111', sku: 'S1' },
      { legacyItemId: '222', sku: '' },
    ]);
    assert.equal(calls[0].auth, 'Bearer USER-TOKEN');
  });
});

test('the access probe is read-only and reports each failure without throwing', async () => {
  await withMockedEbay((call) => {
    if (call.url.includes('/sell/fulfillment/v1/order')) return json({ orders: [] });
    if (call.url.includes('/commerce/notification/v1/subscription')) return json({ errors: [{ errorId: 1100, message: 'Insufficient permissions' }] }, 403);
    return undefined;
  }, async (calls) => {
    const result = await probeNotificationAccess();
    assert.equal(result.orders, 'ok');
    assert.match(result.subscriptions, /^HTTP 403/);
    assert.ok(calls.every((call) => call.method === 'GET'));
  });
});

test('a subscription test posts with no body using the user token and accepts 202', async () => {
  await withMockedEbay((call) => {
    if (call.method === 'POST' && call.url.endsWith('/commerce/notification/v1/subscription/sub-5/test')) return new Response(null, { status: 202 });
    if (call.method === 'POST' && call.url.endsWith('/commerce/notification/v1/subscription/missing/test')) return json({ errors: [{ errorId: 195009 }] }, 404);
    return undefined;
  }, async (calls) => {
    await testNotificationSubscription('sub-5');
    assert.equal(calls[0].body, null);
    assert.equal(calls[0].auth, 'Bearer USER-TOKEN');
    await assert.rejects(testNotificationSubscription('missing'), (error: { statusCode?: number }) => error.statusCode === 404);
  });
});
