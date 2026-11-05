import test from 'node:test';
import assert from 'node:assert/strict';
import { isStatusVisible, pickVisibleFields, resolveAssistantScope } from '../../../../../../aws/src/providers/ai/assistant/scope.js';

test('tester only sees testing items and no finance or seller fields', () => {
  const scope = resolveAssistantScope({ role: 'tester', allowedPages: ['dashboard', 'testing-queue', 'testing'] });
  assert.deepEqual(scope.statuses, ['Testing In Progress']);
  assert.equal(isStatusVisible(scope, 'Testing In Progress'), true);
  assert.equal(isStatusVisible(scope, 'Photography In Progress'), false);
  assert.deepEqual(pickVisibleFields(scope, { Make: 'McIntosh', Cost: 100, 'Seller Email': 'a@b.c' }), { Make: 'McIntosh' });
});

test('photographer only sees photography items', () => {
  const scope = resolveAssistantScope({ role: 'photographer', allowedPages: ['dashboard', 'photography-queue', 'photos'] });
  assert.deepEqual(scope.statuses, ['Photography In Progress']);
});

test('processor sees all stages but not finance or seller fields', () => {
  const scope = resolveAssistantScope({ role: 'processor', allowedPages: ['dashboard', 'inventory', 'testing'] });
  assert.equal(scope.statuses, null);
  assert.deepEqual(pickVisibleFields(scope, { Make: 'Naim', Cost: 5 }), { Make: 'Naim' });
});

test('admin sees everything including finance fields', () => {
  const scope = resolveAssistantScope({ role: 'admin', allowedPages: ['dashboard'] });
  assert.equal(scope.statuses, null);
  assert.deepEqual(pickVisibleFields(scope, { Cost: 5 }), { Cost: 5 });
});

test('listing and post-publish fields follow page access', () => {
  const tester = resolveAssistantScope({ role: 'tester', allowedPages: ['testing'] });
  assert.deepEqual(pickVisibleFields(tester, { 'Shopify Price': 9, 'Shipped At': 'x' }), {});
  const processor = resolveAssistantScope({ role: 'processor', allowedPages: ['inventory', 'listings'] });
  assert.deepEqual(pickVisibleFields(processor, { 'Shopify Price': 9, 'Shipped At': 'x', 'Refund Amount': 5 }), { 'Shopify Price': 9 });
});

test('pickVisibleFields flattens { text } values but leaves other objects alone', async () => {
  const { pickVisibleFields, resolveAssistantScope } = await import('../../../../../../aws/src/providers/ai/assistant/scope.js');
  const scope = resolveAssistantScope({ role: 'admin', allowedPages: ['inventory'] } as never);
  const out = pickVisibleFields(scope, { SKU: { text: '11750', state: 'generated' }, Make: 'Bel Canto', Model: [{ url: 'x' }] });
  assert.equal(out.SKU, '11750');
  assert.equal(out.Make, 'Bel Canto');
  assert.deepEqual(out.Model, [{ url: 'x' }]);
});
