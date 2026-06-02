import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteFormWebhook,
  getForms,
  listFormWebhooks,
  registerFormWebhook,
} from '../../../../../../aws/src/providers/jotform/client.js';

test('listFormWebhooks normalizes webhook records', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.JOTFORM_API_KEY;

  process.env.JOTFORM_API_KEY = 'test-api-key';

  global.fetch = async (input: string | URL | Request) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    assert.match(url, /\/form\/123\/webhooks/);

    return new Response(JSON.stringify({
      responseCode: 200,
      message: 'success',
      content: [
        { id: '11', webhookURL: 'https://example.com/webhook' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await listFormWebhooks('123');
    assert.deepEqual(result, [{ id: '11', webhookUrl: 'https://example.com/webhook' }]);
  } finally {
    global.fetch = originalFetch;
    process.env.JOTFORM_API_KEY = originalApiKey;
  }
});

test('registerFormWebhook submits form-encoded webhookURL payload', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.JOTFORM_API_KEY;

  process.env.JOTFORM_API_KEY = 'test-api-key';

  global.fetch = async (_input, init) => {
    assert.equal(init?.method, 'POST');
    assert.equal(init?.headers instanceof Headers ? init.headers.get('Content-Type') : (init?.headers as Record<string, string> | undefined)?.['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(String(init?.body ?? ''), 'webhookURL=https%3A%2F%2Fexample.com%2Fwebhook');

    return new Response(JSON.stringify({
      responseCode: 200,
      message: 'success',
      content: { id: '22', webhookURL: 'https://example.com/webhook' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await registerFormWebhook({
      formId: '123',
      webhookUrl: 'https://example.com/webhook',
    });

    assert.deepEqual(result, { id: '22', webhookUrl: 'https://example.com/webhook' });
  } finally {
    global.fetch = originalFetch;
    process.env.JOTFORM_API_KEY = originalApiKey;
  }
});

test('deleteFormWebhook hits the JotForm delete endpoint', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.JOTFORM_API_KEY;

  process.env.JOTFORM_API_KEY = 'test-api-key';

  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    assert.match(url, /\/form\/123\/webhooks\/11/);
    assert.equal(init?.method, 'DELETE');

    return new Response(JSON.stringify({
      responseCode: 200,
      message: 'success',
      content: {},
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await deleteFormWebhook('123', '11');
  } finally {
    global.fetch = originalFetch;
    process.env.JOTFORM_API_KEY = originalApiKey;
  }
});