import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../../shared/errors.js';
import { forwardWorkflowEvent, normalizeWorkflowEvent } from './client.js';

function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void> | void): Promise<void> | void {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const restore = () => {
    for (const [key, value] of previousValues.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  try {
    const result = run();
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>).finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test('normalizeWorkflowEvent trims values and preserves supported payload fields', () => {
  const event = normalizeWorkflowEvent({
    name: ' approval_saved ',
    at: '2026-04-28T12:00:00.000Z',
    payload: {
      recordId: ' rec123 ',
      attempts: 2,
      ok: true,
      optional: null,
    },
  });

  assert.deepEqual(event, {
    name: 'approval_saved',
    at: '2026-04-28T12:00:00.000Z',
    payload: {
      recordId: ' rec123 ',
      attempts: 2,
      ok: true,
      optional: null,
    },
  });
});

test('normalizeWorkflowEvent rejects invalid payload shapes', () => {
  assert.throws(
    () => normalizeWorkflowEvent({ name: 'approval_saved', at: 'not-a-date', payload: {} }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, 'INVALID_ANALYTICS_EVENT_TIMESTAMP');
      return true;
    },
  );

  assert.throws(
    () => normalizeWorkflowEvent({ name: 'approval_saved', at: '2026-04-28T12:00:00.000Z', payload: { nested: { nope: true } } }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.code, 'INVALID_ANALYTICS_EVENT_PAYLOAD_VALUE');
      return true;
    },
  );
});

test('forwardWorkflowEvent skips network calls when no forwarding endpoint is configured', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('fetch should not be called');
  }) as typeof fetch;

  try {
    await withEnv({ ANALYTICS_FORWARD_ENDPOINT: undefined }, async () => {
      await forwardWorkflowEvent({
        name: 'approval_saved',
        at: '2026-04-28T12:00:00.000Z',
        payload: {},
      });
    });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('forwardWorkflowEvent posts to configured endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body?: string }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({
      url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    await withEnv({ ANALYTICS_FORWARD_ENDPOINT: 'https://analytics.example.test/events' }, async () => {
      await forwardWorkflowEvent({
        name: 'approval_saved',
        at: '2026-04-28T12:00:00.000Z',
        payload: { recordId: 'rec123' },
      });
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://analytics.example.test/events');
    assert.match(calls[0]?.body ?? '', /approval_saved/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});