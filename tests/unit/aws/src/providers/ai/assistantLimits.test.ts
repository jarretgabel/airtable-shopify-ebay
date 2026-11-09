import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAssistantLimits, recordAssistantTokens, resetAssistantLimitsForTests } from '../../../../../../aws/src/providers/ai/assistant/limits.js';

test.beforeEach(() => {
  resetAssistantLimitsForTests();
  process.env.ASSISTANT_REQUESTS_PER_MINUTE = '2';
  process.env.ASSISTANT_DAILY_TOKEN_CAP = '100';
});

test('limits requests per minute per user and recovers', () => {
  enforceAssistantLimits('a', 1000);
  enforceAssistantLimits('a', 1001);
  assert.throws(() => enforceAssistantLimits('a', 1002), /too quickly/);
  enforceAssistantLimits('b', 1002);
  enforceAssistantLimits('a', 62_000);
});

test('blocks a user after the daily token cap and resets the next day', () => {
  enforceAssistantLimits('a', 1000);
  recordAssistantTokens('a', 150, 1000);
  assert.throws(() => enforceAssistantLimits('a', 70_000), /daily usage limit/);
  enforceAssistantLimits('a', 1000 + 24 * 60 * 60 * 1000);
});

test('shared limits count usage rows in the database and fail open when it is unavailable', async () => {
  const { enforceSharedAssistantLimits, recordSharedAssistantTokens } = await import('../../../../../../aws/src/providers/ai/assistant/limits.js');
  const calls: string[] = [];
  const makePool = (recent: number, tokens: number) => ({
    query: async (text: string) => {
      calls.push(text.slice(0, 6));
      return { rows: [text.startsWith('SELECT') ? { recent, tokens } : { id: 7 }] };
    },
  });
  assert.equal(await enforceSharedAssistantLimits('a', makePool(0, 0)), 7);
  await assert.rejects(enforceSharedAssistantLimits('a', makePool(2, 0)), /too quickly/);
  await assert.rejects(enforceSharedAssistantLimits('a', makePool(0, 100)), /daily usage limit/);
  assert.equal(await enforceSharedAssistantLimits('a', { query: async () => { throw new Error('down'); } }), null);
  assert.equal(await enforceSharedAssistantLimits('a', null), null);
  await recordSharedAssistantTokens(7, 50, makePool(0, 0));
  assert.ok(calls.includes('UPDATE'));
});

test('question log stores trimmed text, keeps it on failure, and ignores missing rows', async () => {
  const { recordSharedAssistantQuestion } = await import('../../../../../../aws/src/providers/ai/assistant/limits.js');
  const seen: unknown[][] = [];
  const pool = { query: async (_text: string, params?: unknown[]) => { seen.push(params ?? []); return { rows: [] }; } };
  await recordSharedAssistantQuestion(5, '  what is left to test?  ', false, pool);
  await recordSharedAssistantQuestion(5, '', true, pool);
  await recordSharedAssistantQuestion(null, 'ignored', false, pool);
  assert.deepEqual(seen, [[5, 'what is left to test?', false], [5, null, true]]);
});
