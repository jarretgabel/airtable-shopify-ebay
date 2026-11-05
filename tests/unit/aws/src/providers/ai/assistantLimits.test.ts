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
