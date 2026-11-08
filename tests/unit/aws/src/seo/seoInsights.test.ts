import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPageSpeedUrl, parsePageSpeed, runPageSpeedSample } from '../../../../../aws/src/seo/pagespeed.js';
import { CITATION_QUESTIONS, parseCitationAnswer, runCitationCheck } from '../../../../../aws/src/seo/citations.js';
import { estimateCost, readCostRates } from '../../../../../aws/src/db/assistantInsights.js';
import { getAssistantToolDefinitions, runAssistantTool } from '../../../../../aws/src/providers/ai/assistant/tools.js';
import { resolveAssistantScope } from '../../../../../aws/src/providers/ai/assistant/scope.js';

type Row = Record<string, unknown>;
function fakeDb(handlers: Array<[RegExp, Row[]]> = []) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  return {
    calls,
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      const match = handlers.find(([pattern]) => pattern.test(text));
      return { rows: match ? match[1] : [] };
    },
  };
}

test('parsePageSpeed converts Lighthouse scores to percentages and rounds timings', () => {
  const parsed = parsePageSpeed({
    lighthouseResult: {
      categories: { performance: { score: 0.734 }, accessibility: { score: 0.9 }, 'best-practices': { score: 1 }, seo: { score: 0.85 } },
      audits: { 'largest-contentful-paint': { numericValue: 2412.6 }, 'cumulative-layout-shift': { numericValue: 0.0123 }, 'total-blocking-time': { numericValue: 180 }, 'first-contentful-paint': { numericValue: 1200.2 } },
    },
  });
  assert.deepEqual(parsed, { performance: 73, accessibility: 90, bestPractices: 100, seo: 85, lcpMs: 2413, fcpMs: 1200, tbtMs: 180, cls: 0.0123 });
  assert.equal(parsePageSpeed({}), null);
});

test('buildPageSpeedUrl requests mobile with every category and an optional key', () => {
  const url = new URL(buildPageSpeedUrl('https://x.com/a', 'k1'));
  assert.equal(url.searchParams.get('strategy'), 'mobile');
  assert.equal(url.searchParams.get('key'), 'k1');
  assert.deepEqual(url.searchParams.getAll('category'), ['performance', 'accessibility', 'best-practices', 'seo']);
  assert.equal(new URL(buildPageSpeedUrl('https://x.com/a')).searchParams.has('key'), false);
});

test('runPageSpeedSample stores scores, and on failure only notes the error', async () => {
  const db = fakeDb([[/FROM \(\s*SELECT url, row_number/, [{ url: 'https://x.com/products/a' }]]]);
  const fetcher = async (url: string) => (url.includes('products')
    ? { ok: false, status: 429, json: async () => ({}) }
    : { ok: true, status: 200, json: async () => ({ lighthouseResult: { categories: { performance: { score: 0.5 } }, audits: {} } }) });
  const result = await runPageSpeedSample(db, { siteUrl: 'https://x.com', fetcher, delayMs: 0 });
  assert.deepEqual(result, { checked: 1, failed: 1 });
  const inserts = db.calls.filter((call) => call.text.includes('INSERT INTO seo_pagespeed'));
  assert.equal(inserts.length, 2);
  assert.match(String(inserts[1].values?.[1]), /quota/);
  assert.ok(!inserts[1].text.includes('performance ='), 'a failure must not overwrite earlier scores');
});

test('parseCitationAnswer detects a brand mention and a cited site', () => {
  const named = parseCitationAnswer('q', [
    { type: 'web_search_tool_result', content: [{ url: 'https://www.resolutionavnyc.com/pages/about' }, { url: 'https://reverb.com/x' }] },
    { type: 'text', text: 'Try Resolution AV in Brooklyn.', citations: [{ url: 'https://reverb.com/y' }] },
  ]);
  assert.equal(named.mentioned, true);
  assert.equal(named.cited, true);
  assert.equal(named.sources[0], 'resolutionavnyc.com');
  const absent = parseCitationAnswer('q', [{ type: 'text', text: 'Try Stereo Exchange.', citations: [{ url: 'https://stereoexchange.com' }] }]);
  assert.equal(absent.mentioned, false);
  assert.equal(absent.cited, false);
});

test('runCitationCheck records each answer and totals the run', async () => {
  const db = fakeDb();
  const fetcher = async (_url: string, init: { body: string }) => {
    const question = (JSON.parse(init.body) as { messages: Array<{ content: string }> }).messages[0].content;
    const text = question.startsWith('What is Resolution') ? 'Resolution AV is a Brooklyn hi-fi store.' : 'Try Reverb.';
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }) };
  };
  await runCitationCheck(db, 5, { apiKey: 'k', model: 'm', fetcher });
  assert.equal(db.calls.filter((call) => call.text.includes('INSERT INTO seo_citation_checks')).length, CITATION_QUESTIONS.length);
  const finish = db.calls.find((call) => call.text.includes('UPDATE seo_citation_runs SET status'));
  assert.deepEqual(finish?.values, [5, 'completed', CITATION_QUESTIONS.length, 1, 0]);
});

test('runCitationCheck stops early and fails the run when the first answers all error', async () => {
  const db = fakeDb();
  const fetcher = async () => ({ ok: false, status: 400, json: async () => ({}) });
  await runCitationCheck(db, 6, { apiKey: 'k', model: 'm', fetcher });
  assert.equal(db.calls.filter((call) => call.text.includes('INSERT INTO seo_citation_checks')).length, 2);
  assert.equal(db.calls.find((call) => call.text.includes('UPDATE seo_citation_runs SET status'))?.values?.[1], 'failed');
});

test('assistant cost estimate uses token rates, overridable by env', () => {
  assert.equal(estimateCost(1_000_000, 1_000_000, readCostRates({})), 6);
  assert.deepEqual(readCostRates({ ASSISTANT_COST_INPUT_PER_MTOK: '3', ASSISTANT_COST_OUTPUT_PER_MTOK: '15' } as never), { inputPerMillion: 3, outputPerMillion: 15 });
});

test('the SEO tool follows the SEO page, and refuses anyone without it', async () => {
  const names = (role: 'owner' | 'processor' | 'admin', pages: string[]) => getAssistantToolDefinitions(resolveAssistantScope({ role, allowedPages: pages } as never)).map((tool) => tool.name);
  assert.ok(names('owner', ['inventory', 'seo']).includes('get_seo_insights'));
  assert.ok(!names('processor', ['inventory']).includes('get_seo_insights'));
  assert.ok(!names('admin', ['dashboard']).includes('get_seo_insights'));
  const scope = resolveAssistantScope({ role: 'processor', allowedPages: ['inventory'] } as never);
  assert.deepEqual(await runAssistantTool(scope, 'get_seo_insights', {}), { error: 'You do not have access to the SEO dashboard.' });
});
