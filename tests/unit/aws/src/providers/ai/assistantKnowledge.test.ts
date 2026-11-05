import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkVisible, searchKnowledge, type KnowledgeChunk } from '../../../../../../aws/src/providers/ai/assistant/knowledge.js';
import { KNOWLEDGE_CHUNKS } from '../../../../../../aws/src/providers/ai/assistant/knowledge.generated.js';
import { resolveAssistantScope } from '../../../../../../aws/src/providers/ai/assistant/scope.js';

const chunks: KnowledgeChunk[] = [
  { id: '1', source: 'Guide', title: 'Testing queue', text: 'Testers sign off hands-on testing before photography.', audience: 'all', pages: ['testing'] },
  { id: '2', source: 'Operator guide', title: 'Listings approval', text: 'Approve listings for publish after pricing review.', audience: 'workflow', pages: ['listings'] },
  { id: '3', source: 'Troubleshooting', title: 'Deploy errors', text: 'Deploy failures and SAM errors for developers.', audience: 'full-access' },
  { id: '4', source: 'Guide', title: 'photographer quick start', text: 'Photographers upload images.', audience: 'all', roles: ['photographer'] },
];

const tester = resolveAssistantScope({ role: 'tester', allowedPages: ['dashboard', 'testing-queue', 'testing'] });
const admin = resolveAssistantScope({ role: 'admin', allowedPages: ['dashboard'] });

test('testers only get audience-appropriate chunks', () => {
  assert.equal(isChunkVisible(tester, chunks[0]), true);
  assert.equal(isChunkVisible(tester, chunks[1]), false);
  assert.equal(isChunkVisible(tester, chunks[2]), false);
  assert.equal(isChunkVisible(tester, chunks[3]), false);
});

test('full-access roles see every chunk', () => {
  assert.ok(chunks.every((chunk) => isChunkVisible(admin, chunk)));
});

test('search ranks relevant chunks and respects visibility', () => {
  assert.equal(searchKnowledge(tester, 'how does testing sign off work', chunks)[0]?.title, 'Testing queue');
  assert.equal(searchKnowledge(tester, 'deploy errors', chunks).length, 0);
  assert.equal(searchKnowledge(admin, 'deploy errors', chunks)[0]?.title, 'Deploy errors');
});

test('generated knowledge is populated', () => {
  assert.ok(KNOWLEDGE_CHUNKS.length > 20);
});

test('guideRecordsToChunks scopes role guides by role and page guides by page', async () => {
  const { guideRecordsToChunks, isChunkVisible } = await import('../../../../../../aws/src/providers/ai/assistant/knowledge.js');
  const { resolveAssistantScope } = await import('../../../../../../aws/src/providers/ai/assistant/scope.js');
  const chunks = guideRecordsToChunks([
    { id: 'r1', fields: { Name: 'Tester quick start', 'Content Type': 'role-guide', Role: 'tester', 'Role Summary': 'Test items.' } },
    { id: 'r2', fields: { Name: 'Page - Listings', 'Content Type': 'page-guide', 'Page 1': 'listings', Summary: 'Listings page.' } },
    { id: 'r3', fields: { Name: 'Empty', 'Content Type': 'page-guide' } },
  ]);
  assert.equal(chunks.length, 2);
  const tester = resolveAssistantScope({ role: 'tester', allowedPages: ['testing'] } as never);
  assert.equal(isChunkVisible(tester, chunks[0]), true);
  assert.equal(isChunkVisible(tester, chunks[1]), false);
  const photographer = resolveAssistantScope({ role: 'photographer', allowedPages: ['photography'] } as never);
  assert.equal(isChunkVisible(photographer, chunks[0]), false);
});
