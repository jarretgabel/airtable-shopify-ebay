import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssistantToolDefinitions, runAssistantTool } from '../../../../../../aws/src/providers/ai/assistant/tools.js';
import { resolveAssistantScope } from '../../../../../../aws/src/providers/ai/assistant/scope.js';

const names = (role: 'admin' | 'processor' | 'tester', pages: string[]) =>
  getAssistantToolDefinitions(resolveAssistantScope({ role, allowedPages: pages })).map((tool) => tool.name);

test('customer tools are offered to full-access roles only', () => {
  assert.ok(names('admin', ['dashboard']).includes('get_seller_history'));
  assert.ok(!names('processor', ['inventory', 'listings']).includes('search_customers'));
  assert.ok(!names('tester', ['testing']).includes('get_customer'));
});

test('customer tools refuse non-full-access callers even if invoked', async () => {
  const scope = resolveAssistantScope({ role: 'processor', allowedPages: ['inventory'] });
  assert.deepEqual(await runAssistantTool(scope, 'search_customers', { query: 'a' }), { error: 'You do not have access to customer data.' });
  assert.deepEqual(await runAssistantTool(scope, 'get_seller_history', { email: 'a@b.c' }), { error: 'You do not have access to customer data.' });
});

test('intake drafting tool is offered only to roles with intake pages', () => {
  assert.ok(names('processor', ['manual-intake']).includes('propose_intake_item'));
  assert.ok(!names('tester', ['testing']).includes('propose_intake_item'));
});

test('intake drafting tool refuses roles without intake pages', async () => {
  const scope = resolveAssistantScope({ role: 'tester', allowedPages: ['testing'] });
  assert.deepEqual(await runAssistantTool(scope, 'propose_intake_item', { make: 'X' }), { error: 'You do not have access to create intake items.' });
});

test('stage form drafting follows the testing and photos pages', async () => {
  assert.ok(names('tester', ['testing']).includes('propose_stage_update'));
  assert.ok(names('photographer', ['photos']).includes('propose_stage_update'));
  assert.ok(!names('processor', ['manual-intake']).includes('propose_stage_update'));
  const scope = resolveAssistantScope({ role: 'tester', allowedPages: ['testing'] });
  assert.deepEqual(await runAssistantTool(scope, 'propose_stage_update', { stage: 'photos', record_id: 'recAAAAAAAAAAAA' }), { error: 'You do not have access to that form.' });
});

test('cleanSearchQuery drops label words but keeps the identifier', async () => {
  const { cleanSearchQuery } = await import('../../../../../../aws/src/providers/ai/assistant/tools.js');
  assert.equal(cleanSearchQuery('SKU 11750'), '11750');
  assert.equal(cleanSearchQuery('sku #11750'), '11750');
  assert.equal(cleanSearchQuery('McIntosh MC275'), 'McIntosh MC275');
  assert.equal(cleanSearchQuery('sku'), 'sku');
});

test('mergeItemSummaries reports a record present in both tables once', async () => {
  const { mergeItemSummaries } = await import('../../../../../../aws/src/providers/ai/assistant/tools.js');
  const merged = mergeItemSummaries(
    [{ id: 'rec1', link: '/workflow-hub/rec1', 'Workflow Status': 'Testing In Progress' }],
    [{ id: 'rec1', link: '/listings/rec1', 'Workflow Status': 'Approved for Publish', publishReadiness: { state: 'ready to publish' } }, { id: 'rec2', link: '/listings/rec2' }],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].listingLink, '/listings/rec1');
  assert.equal(merged[0].listingStatus, 'Approved for Publish');
  assert.deepEqual(merged[0].publishReadiness, { state: 'ready to publish' });
  assert.equal(merged[1].id, 'rec2');
});
