import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_EBAY_NOTIFICATION_TOPICS,
  runEbayNotificationSetup,
  type EbayNotificationSetupDependencies,
} from '../../../../../aws/src/services/ebayNotificationSetup.js';

const ENDPOINT = 'https://hooks.example.com/api/hooks/ebay/notifications';
const TOKEN = 'a'.repeat(40);

function build(overrides: Partial<EbayNotificationSetupDependencies> = {}) {
  const writes: string[] = [];
  const dependencies: EbayNotificationSetupDependencies = {
    endpoint: ENDPOINT,
    verificationToken: TOKEN,
    topics: ['ORDER_CONFIRMATION', 'ORDER_RETURN_ACTIVITY'],
    listDestinations: async () => [],
    listSubscriptions: async () => [],
    getTopicSchemaVersion: async (topicId) => `${topicId}-v1`,
    createDestination: async (input) => { writes.push(`destination:${input.endpoint}`); return 'dest-1'; },
    createSubscription: async (input) => { writes.push(`subscription:${input.topicId}:${input.destinationId}:${input.schemaVersion}`); return `sub-${input.topicId}`; },
    ...overrides,
  };
  return { dependencies, writes };
}

test('defaults cover sales, cancellations and returns', () => {
  assert.deepEqual([...DEFAULT_EBAY_NOTIFICATION_TOPICS], ['ORDER_CONFIRMATION', 'ORDER_CANCELLATION_ACTIVITY', 'ORDER_RETURN_ACTIVITY']);
});

test('a dry run plans every missing step and performs no write', async () => {
  const { dependencies, writes } = build();
  const result = await runEbayNotificationSetup(dependencies, { apply: false });
  assert.deepEqual(writes, []);
  assert.deepEqual(result.actions.map((a) => `${a.type}:${a.target}:${a.state}`), [
    'destination:' + ENDPOINT + ':planned',
    'subscription:ORDER_CONFIRMATION:planned',
    'subscription:ORDER_RETURN_ACTIVITY:planned',
  ]);
});

test('apply creates the destination first, then one subscription per topic', async () => {
  const { dependencies, writes } = build();
  const result = await runEbayNotificationSetup(dependencies, { apply: true });
  assert.deepEqual(writes, [
    `destination:${ENDPOINT}`,
    'subscription:ORDER_CONFIRMATION:dest-1:ORDER_CONFIRMATION-v1',
    'subscription:ORDER_RETURN_ACTIVITY:dest-1:ORDER_RETURN_ACTIVITY-v1',
  ]);
  assert.ok(result.actions.every((a) => a.state === 'created'));
});

test('is idempotent: an existing destination and subscriptions are reused, only missing ones are created', async () => {
  const { dependencies, writes } = build({
    listDestinations: async () => [{ destinationId: 'dest-9', endpoint: ENDPOINT, status: 'ENABLED' }],
    listSubscriptions: async () => [{ subscriptionId: 's-1', topicId: 'ORDER_CONFIRMATION', destinationId: 'dest-9', status: 'ENABLED' }],
  });
  const result = await runEbayNotificationSetup(dependencies, { apply: true });
  assert.deepEqual(writes, ['subscription:ORDER_RETURN_ACTIVITY:dest-9:ORDER_RETURN_ACTIVITY-v1']);
  assert.deepEqual(result.actions.map((a) => `${a.type}:${a.target}:${a.state}`), [
    'destination:' + ENDPOINT + ':exists',
    'subscription:ORDER_CONFIRMATION:exists',
    'subscription:ORDER_RETURN_ACTIVITY:created',
  ]);
});

test('warns about a disabled or marked-down destination and a disabled subscription instead of changing them', async () => {
  const { dependencies, writes } = build({
    listDestinations: async () => [{ destinationId: 'dest-9', endpoint: ENDPOINT, status: 'MARKED_DOWN' }],
    listSubscriptions: async () => [{ subscriptionId: 's-1', topicId: 'ORDER_CONFIRMATION', destinationId: 'dest-9', status: 'DISABLED' }],
    topics: ['ORDER_CONFIRMATION'],
  });
  const result = await runEbayNotificationSetup(dependencies, { apply: true });
  assert.deepEqual(writes, []);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /MARKED_DOWN/);
  assert.match(result.warnings[1], /DISABLED/);
});

test('refuses unsafe configuration before any call is made', async () => {
  for (const [label, overrides] of Object.entries({
    'http endpoint': { endpoint: 'http://hooks.example.com/api/hooks/ebay/notifications' },
    localhost: { endpoint: 'https://localhost/api/hooks/ebay/notifications' },
    'short token': { verificationToken: 'short' },
    'bad token chars': { verificationToken: 'a'.repeat(31) + '!' },
    'no topics': { topics: [] },
  })) {
    let called = false;
    const { dependencies } = build({
      ...(overrides as Partial<EbayNotificationSetupDependencies>),
      listDestinations: async () => { called = true; return []; },
    });
    await assert.rejects(runEbayNotificationSetup(dependencies, { apply: true }), /./, label);
    assert.equal(called, false, label);
  }
});

test('a failed subscription stops the run and reports what was already created', async () => {
  const { dependencies } = build({
    createSubscription: async (input) => {
      if (input.topicId === 'ORDER_RETURN_ACTIVITY') {
        throw new Error('195011 not authorized for topic');
      }
      return 'sub-1';
    },
  });
  await assert.rejects(
    runEbayNotificationSetup(dependencies, { apply: true }),
    (error: Error & { completed?: string[] }) => /195011/.test(error.message) && error.completed?.length === 2,
  );
});
