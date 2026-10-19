import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateDescription,
  generateKeyFeatures,
  generateTitle,
  parseCategoryPickOutput,
  parseCategoryQueriesOutput,
  parseCollectionsPickOutput,
  parseKeyFeaturesOutput,
  parseTagsPickOutput,
  sanitizeDescriptionOutput,
  sanitizeSingleLineOutput,
  sanitizeTitleOutput,
  trimToSentence,
} from '../../../../../../aws/src/providers/ai/client.js';

test('sanitizeDescriptionOutput strips markup and exclamation points', () => {
  const result = sanitizeDescriptionOutput('```\n## Title\n<p>**McIntosh** MC275 sounds warm!</p>\n\n\n\n* Power: 75W\n```');
  assert.equal(result, 'Title\nMcIntosh MC275 sounds warm.');
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

test('sanitizeTitleOutput keeps one clean line and caps at 80 characters', () => {
  assert.equal(sanitizeTitleOutput('Title: "McIntosh MC275 Tube Amplifier!"\nextra line'), 'McIntosh MC275 Tube Amplifier');
  const long = sanitizeTitleOutput('McIntosh MC275 Vacuum Tube Stereo Power Amplifier Pre-Owned Serviced Original Cage Included');
  assert.ok(long.length <= 80);
  assert.doesNotMatch(long, /\s$/);
});

test('generateTitle uses the title prompt and returns a clean title', async () => {
  const originalFetch = global.fetch;
  const saved = { a: process.env.ANTHROPIC_API_KEY };
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  let system = '';
  global.fetch = async (_input, init) => {
    system = JSON.parse(String(init?.body)).system;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Leben CS300 Integrated Amplifier Pre-Owned' }] }), { status: 200 });
  };

  try {
    const result = await generateTitle({ Brand: 'Leben', Model: 'CS300' });
    assert.equal(result, 'Leben CS300 Integrated Amplifier Pre-Owned');
    assert.match(system, /80 characters maximum/);
  } finally {
    global.fetch = originalFetch;
    if (saved.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.a;
  }
});

test('parseKeyFeaturesOutput cleans, dedupes and drops excluded or invalid rows', () => {
  const raw = 'Here you go:\n[{"feature":"Service History","value":"Serviced in 2024!"},{"feature":"Make","value":"Leben"},{"feature":"service history","value":"dup"},{"feature":"Inputs"},{"feature":"Tubes","value":"  4 x EL84 "}]';
  assert.deepEqual(parseKeyFeaturesOutput(raw, ['Make']), [
    { feature: 'Service History', value: 'Serviced in 2024.' },
    { feature: 'Tubes', value: '4 x EL84' },
  ]);
  assert.deepEqual(parseKeyFeaturesOutput('no json here'), []);
});

test('parseKeyFeaturesOutput drops equivalents of automatically mapped rows', () => {
  const raw = JSON.stringify([
    { feature: 'Included', value: 'Original box' },
    { feature: 'Weight', value: '15 lbs' },
    { feature: 'Dimensions', value: '20x18x10' },
    { feature: 'Conductor Geometry', value: 'Multi-gauge network design [CHECK]' },
  ]);
  assert.deepEqual(parseKeyFeaturesOutput(raw), [
    { feature: 'Conductor Geometry', value: 'Multi-gauge network design [CHECK]' },
  ]);
});

test('parseKeyFeaturesOutput ignores prose and citation brackets around the JSON', () => {
  const raw = 'I will search [1] for specs.```json\n[{"feature":"Made In","value":"USA"}]\n```';
  assert.deepEqual(parseKeyFeaturesOutput(raw), [{ feature: 'Made In', value: 'USA' }]);
});

test('parseKeyFeaturesOutput strips web search citation tags', () => {
  const raw = '[{"feature":"Made In","value":"<cite index=\\"4-1\\">USA</cite>"}]';
  assert.deepEqual(parseKeyFeaturesOutput(raw), [{ feature: 'Made In', value: 'USA' }]);
});

test('generateKeyFeatures sends the features prompt and returns parsed rows', async () => {
  const originalFetch = global.fetch;
  const saved = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

  let sent: { system: string; messages: Array<{ content: string }> } | undefined;
  global.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '[{"feature":"Tubes","value":"4 x EL84"}]' }] }), { status: 200 });
  };

  try {
    const result = await generateKeyFeatures({ Notes: 'Four EL84 tubes' }, ['Inputs']);
    assert.deepEqual(result, [{ feature: 'Tubes', value: '4 x EL84' }]);
    assert.match(sent?.system ?? '', /Other Key Features/);
    assert.match(sent?.messages[0].content ?? '', /Notes: Four EL84 tubes/);
    assert.match(sent?.messages[0].content ?? '', /do not repeat\): Inputs/);
  } finally {
    global.fetch = originalFetch;
    if (saved === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('sanitizeSingleLineOutput strips labels and quotes and trims to a word boundary', () => {
  assert.equal(sanitizeSingleLineOutput('SEO Title: "Leben CS300 Tube Integrated Amplifier!"', 60), 'Leben CS300 Tube Integrated Amplifier.');
  const long = sanitizeSingleLineOutput('Leben CS300 Tube Integrated Amplifier Pre-Owned Serviced Hi-Fi Brooklyn', 60);
  assert.ok(long.length <= 60);
  assert.ok(!long.endsWith(' '));
});

test('parseKeyFeaturesOutput drops packaging and "included" rows already covered by automatic mappings', () => {
  const raw = JSON.stringify([
    { feature: 'Original Packaging', value: 'Included with cables' },
    { feature: 'Accessories', value: 'Remote and manual' },
    { feature: 'Conductor', value: 'Silver-plated copper' },
  ]);
  assert.deepEqual(parseKeyFeaturesOutput(raw), [{ feature: 'Conductor', value: 'Silver-plated copper' }]);
});

test('trimToSentence ends on a full sentence when the text is too long', () => {
  const text = 'Pre-owned MIT MI-330 interconnect cables, tested and in the original box. Hear them in our Brooklyn listening room before you decide.';
  assert.equal(trimToSentence(text, 100), 'Pre-owned MIT MI-330 interconnect cables, tested and in the original box.');
  assert.equal(trimToSentence('Short text.', 160), 'Short text.');
});

test('parseCategoryQueriesOutput keeps up to three short unique phrases', () => {
  assert.deepEqual(
    parseCategoryQueriesOutput('```json\n["tube integrated amplifier", "tube integrated amplifier", "amplifier", "audio", "extra"]\n```'),
    ['tube integrated amplifier', 'amplifier', 'audio'],
  );
  assert.deepEqual(parseCategoryQueriesOutput('no json here'), []);
});

test('parseCategoryPickOutput only accepts ids from the candidate list', () => {
  const candidates = [{ id: '123', label: 'Amplifiers' }, { id: '456', label: 'Cables' }];
  assert.equal(parseCategoryPickOutput('{"id": "456"}', candidates), '456');
  assert.equal(parseCategoryPickOutput('{"id": 123}', candidates), '123');
  assert.equal(parseCategoryPickOutput('{"id": "999"}', candidates), null);
  assert.equal(
    parseCategoryPickOutput('{"id": "el-7-7-1"}', [{ id: 'gid://shopify/TaxonomyCategory/el-7-7-1', label: 'Cables' }]),
    'gid://shopify/TaxonomyCategory/el-7-7-1',
  );
  assert.equal(parseCategoryPickOutput('{"id": null}', candidates), null);
});

test('parseCollectionsPickOutput keeps up to three known collections and tolerates shortened ids', () => {
  const candidates = ['1', '2', '3', '4'].map((n) => ({ id: `gid://shopify/Collection/${n}`, label: `Collection ${n}` }));
  assert.deepEqual(
    parseCollectionsPickOutput('{"ids": ["1", "gid://shopify/Collection/2", "999", 3, "4"]}', candidates),
    ['gid://shopify/Collection/1', 'gid://shopify/Collection/2', 'gid://shopify/Collection/3'],
  );
  assert.deepEqual(parseCollectionsPickOutput('{"ids": []}', candidates), []);
  assert.deepEqual(parseCollectionsPickOutput('nope', candidates), []);
});

test('parseTagsPickOutput separates existing tags from brand-new ones', () => {
  const vocabulary = ['Cables', 'Pre-Owned Hifi', 'Speaker Cables'];
  assert.deepEqual(
    parseTagsPickOutput(
      '```json\n{"tags": ["cables", "pre-owned hifi", "cables"], "newTags": ["Interconnects", "speaker cables", "bad, tag", "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]}\n```',
      vocabulary,
    ),
    { tags: ['Cables', 'Pre-Owned Hifi', 'Speaker Cables'], newTags: ['Interconnects'] },
  );
  assert.deepEqual(parseTagsPickOutput('{"tags": []}', vocabulary), { tags: [], newTags: [] });
  assert.deepEqual(parseTagsPickOutput('nope', vocabulary), { tags: [], newTags: [] });
});

test('sanitizeDescriptionOutput drops spec-style lines but keeps prose that has a colon mid-sentence', () => {
  const raw = 'The MI-330 sounds open and quick. One thing to know: it is a used pair.\n\nConductor: Silver-plated copper\nLength: 6 ft\n\nWant to hear it? Come listen in Brooklyn.';
  assert.equal(
    sanitizeDescriptionOutput(raw),
    'The MI-330 sounds open and quick. One thing to know: it is a used pair.\n\nWant to hear it? Come listen in Brooklyn.',
  );
});
