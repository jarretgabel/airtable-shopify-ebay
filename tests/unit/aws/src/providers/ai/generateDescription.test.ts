import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDescription,
  sanitizeDescriptionOutput,
} from '../../../../../../aws/src/providers/ai/client.js';

test('sanitizeDescriptionOutput strips markup and exclamation points', () => {
  const result = sanitizeDescriptionOutput('```\n## Title\n<p>**McIntosh** MC275 sounds warm!</p>\n\n\n\n* Power: 75W\n```');
  assert.equal(result, 'Title\nMcIntosh MC275 sounds warm.\n\nPower: 75W');
});

test('generateDescription sends brand prompt and listing facts, returns clean text', async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalGithub = process.env.GITHUB_TOKEN;
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.GITHUB_TOKEN;

  let requestBody: { messages: Array<{ role: string; content: string }> } | undefined;
  global.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'McIntosh MC275 is a pre-owned tube amplifier!' } }],
    }), { status: 200 });
  };

  try {
    const result = await generateDescription({ Brand: 'McIntosh', Model: 'MC275', Empty: '  ' });
    assert.equal(result, 'McIntosh MC275 is a pre-owned tube amplifier.');
    assert.equal(requestBody?.messages[0].role, 'system');
    assert.match(requestBody?.messages[0].content ?? '', /Resolution Audio Video/);
    assert.match(requestBody?.messages[1].content ?? '', /Brand: McIntosh/);
    assert.doesNotMatch(requestBody?.messages[1].content ?? '', /Empty:/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    if (originalGithub !== undefined) process.env.GITHUB_TOKEN = originalGithub;
  }
});

test('generateDescription uses Anthropic when ANTHROPIC_API_KEY is set', async () => {
  const originalFetch = global.fetch;
  const saved = { a: process.env.ANTHROPIC_API_KEY, o: process.env.OPENAI_API_KEY };
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.OPENAI_API_KEY = 'should-not-be-used';

  let call: { url: string; headers: Record<string, string>; body: { system: string; messages: Array<{ content: string }> } } | undefined;
  global.fetch = async (input, init) => {
    call = {
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Leben CS300 sounds warm!' }] }), { status: 200 });
  };

  try {
    const result = await generateDescription({ Brand: 'Leben', Model: 'CS300' });
    assert.equal(result, 'Leben CS300 sounds warm.');
    assert.equal(call?.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(call?.headers['x-api-key'], 'sk-ant-test');
    assert.match(call?.body.system ?? '', /Resolution Audio Video/);
    assert.match(call?.body.messages[0].content ?? '', /Brand: Leben/);
  } finally {
    global.fetch = originalFetch;
    if (saved.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.a;
    if (saved.o === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.o;
  }
});
