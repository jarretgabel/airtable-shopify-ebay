import test from 'node:test';
import assert from 'node:assert/strict';
import { listIssues, updateIssue } from '../../../../../aws/src/db/issues.js';
import { getAssistantToolDefinitions, runAssistantTool } from '../../../../../aws/src/providers/ai/assistant/tools.js';
import { resolveAssistantScope } from '../../../../../aws/src/providers/ai/assistant/scope.js';

type Row = Record<string, unknown>;
const issueRow = (extra: Row = {}): Row => ({
  id: 7, kind: 'bug', title: 'Broken', description: '', priority: 'normal', status: 'open', area: null, page_url: null, source: 'app',
  submitted_by_name: 'Sam', submitted_by_email: 'sam@x.com', assigned_to_name: null, assigned_to_email: null,
  resolved_by_name: null, resolved_by_email: null, resolved_at: null, resolution_note: null, created_at: new Date(), updated_at: new Date(), ...extra,
});

function fakeDb(row: Row) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return { rows: /^\s*SELECT \* FROM issues WHERE id/.test(text) ? [row] : [] };
    },
  };
}

const me = { name: 'Dev', email: 'dev@x.com' };

test('resolving an issue records who resolved it and logs the status change', async () => {
  const db = fakeDb(issueRow());
  await updateIssue(db, 7, { status: 'resolved' }, me);
  const update = db.calls.find((call) => call.text.startsWith('UPDATE issues'));
  assert.ok(update);
  assert.match(update.text, /resolved_by_name = \$\d/);
  assert.match(update.text, /resolved_at = now\(\)/);
  assert.ok(update.values?.includes('Dev') && update.values?.includes('dev@x.com'));
  const event = db.calls.find((call) => call.text.startsWith('INSERT INTO issue_events'));
  assert.deepEqual(event?.values, [7, 'Dev', 'dev@x.com', 'status', 'open', 'resolved']);
});

test('reopening clears the resolver and an unchanged update writes nothing', async () => {
  const resolved = issueRow({ status: 'resolved', resolved_by_name: 'Dev', resolved_by_email: 'dev@x.com', resolved_at: new Date() });
  const reopen = fakeDb(resolved);
  await updateIssue(reopen, 7, { status: 'open' }, me);
  assert.match(reopen.calls.find((call) => call.text.startsWith('UPDATE issues'))?.text ?? '', /resolved_by_name = NULL/);

  const noop = fakeDb(issueRow());
  await updateIssue(noop, 7, { status: 'open', priority: 'normal' }, me);
  assert.equal(noop.calls.some((call) => call.text.startsWith('UPDATE issues')), false);
});

test('updateIssue returns null for a missing issue', async () => {
  assert.equal(await updateIssue({ query: async () => ({ rows: [] }) }, 99, { status: 'closed' }, me), null);
});

test('search escapes LIKE wildcards and matches an issue number', async () => {
  const db = fakeDb(issueRow());
  await listIssues(db, { search: '#12 100%' });
  const query = db.calls[0];
  assert.match(query.text, /ILIKE \$1/);
  assert.equal(query.values?.[0], '%12 100\\%%');
  assert.equal(query.values?.[1], '12 100%');
});

test('issue tools are only offered to roles with the Issues page', () => {
  const names = (pages: string[]) => getAssistantToolDefinitions(resolveAssistantScope({ role: 'processor', allowedPages: pages })).map((tool) => tool.name);
  assert.ok(names(['issues']).includes('create_issue'));
  assert.equal(names(['dashboard']).includes('create_issue'), false);
});

test('issue tools refuse users without the Issues page', async () => {
  const scope = resolveAssistantScope({ role: 'tester', allowedPages: ['testing'], name: 'T', email: 't@x.com' });
  const result = await runAssistantTool(scope, 'create_issue', { kind: 'bug', title: 'x' });
  assert.deepEqual(result, { error: 'You do not have access to the Issues tracker.' });
});
