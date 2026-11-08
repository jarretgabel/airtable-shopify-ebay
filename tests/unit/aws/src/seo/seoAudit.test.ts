import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl, extractSignals } from '../../../../../aws/src/seo/htmlSignals.js';
import { failedPageScores, scorePage } from '../../../../../aws/src/seo/scoring.js';
import { blockedAiCrawlers, buildSiteChecks } from '../../../../../aws/src/seo/siteChecks.js';
import { discoverPages, parseSitemap, runSeoAudit, type Fetcher } from '../../../../../aws/src/seo/crawl.js';

const GOOD_PRODUCT = `<!doctype html><html lang="en"><head>
<title>McIntosh MC275 Tube Amplifier | Resolution AV</title>
<meta name="description" content="Vintage McIntosh MC275 stereo tube power amplifier, fully serviced and tested, with warranty and fast insured shipping.">
<meta name="viewport" content="width=device-width"><meta property="og:title" content="MC275"><meta property="og:image" content="x.jpg">
<link rel="canonical" href="https://example.com/products/mc275">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"MC275","brand":{"@type":"Brand","name":"McIntosh"},"offers":{"@type":"Offer","price":"3999","availability":"https://schema.org/InStock"}},{"@type":"BreadcrumbList"},{"@type":"FAQPage"}],"dateModified":"2026-10-01"}</script>
</head><body><header><a href="/">Home</a></header><main>
<h1>McIntosh MC275</h1><h2>Condition</h2><h2>Specifications</h2><h2>Is it serviced?</h2>
<p>${'word '.repeat(240)}</p><ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li><li>f</li></ul>
<img src="a.jpg" alt="MC275 front"><a href="/collections/amps">Amps</a><a href="/pages/about">About</a><a href="/products/other">Other</a>
</main><footer>${'footer '.repeat(500)}</footer></body></html>`;

test('classifyUrl recognises Shopify page types', () => {
  assert.equal(classifyUrl('https://x.com/'), 'home');
  assert.equal(classifyUrl('https://x.com/products/a'), 'product');
  assert.equal(classifyUrl('https://x.com/collections/amps/products/a'), 'collection');
  assert.equal(classifyUrl('https://x.com/blogs/news/post'), 'blog');
  assert.equal(classifyUrl('https://x.com/pages/about'), 'page');
});

test('extractSignals counts empty alt as decorative, ignores noscript duplicates and data-alt', () => {
  const html = `<html><body><main>
<img src="a.jpg" alt="Front">
<img src="b.jpg" alt="">
<img src="c.jpg" alt>
<img src="d.jpg" data-alt="not an alt">
<img src="e.jpg">
<img src="lazy.jpg" alt="Lazy"><noscript><img src="lazy.jpg"><img src="x.jpg" alt=""></noscript>
</main></body></html>`;
  const s = extractSignals(html, 'https://example.com/');
  assert.equal(s.imageCount, 6);
  assert.equal(s.imagesWithAlt, 4);
});

test('extractSignals reads head tags, JSON-LD and main content only', () => {
  const s = extractSignals(GOOD_PRODUCT, 'https://example.com/products/mc275');
  assert.equal(s.title, 'McIntosh MC275 Tube Amplifier | Resolution AV');
  assert.equal(s.h1s.length, 1);
  assert.equal(s.canonical, 'https://example.com/products/mc275');
  assert.equal(s.lang, 'en');
  assert.ok(s.schemaTypes.includes('Product') && s.schemaTypes.includes('FAQPage'));
  assert.deepEqual(s.productSchema, { hasOffer: true, hasPrice: true, hasAvailability: true, hasBrand: true });
  assert.equal(s.questionHeadings, 1);
  assert.equal(s.dateModified, '2026-10-01');
  assert.ok(s.wordCount > 240 && s.wordCount < 300, `footer must not count, got ${s.wordCount}`);
  assert.equal(s.internalLinks, 3);
  assert.equal(s.hasListOrTable, true);
});

test('a well-built product page scores high and a bare page scores low', () => {
  const good = scorePage(extractSignals(GOOD_PRODUCT, 'https://example.com/products/mc275'), 'product', { statusCode: 200, lastModified: null, now: new Date('2026-11-07') });
  assert.ok(good.seoScore >= 90, `seo ${good.seoScore}`);
  assert.ok(good.aioScore >= 90, `aio ${good.aioScore}`);

  const bare = scorePage(extractSignals('<html><head></head><body><p>hi</p></body></html>', 'https://example.com/products/x'), 'product', { statusCode: 200, lastModified: null });
  assert.ok(bare.seoScore < 40 && bare.aioScore < 30);
  assert.ok(bare.issues.some((issue) => issue.id === 'description-present'));
  assert.ok(bare.issues.some((issue) => issue.id === 'aio-schema' && /Product schema/.test(issue.detail ?? '')));
  assert.deepEqual(bare.issues.map((issue) => issue.lost), [...bare.issues.map((issue) => issue.lost)].sort((a, b) => b - a));
});

test('failed pages score zero with a clear issue', () => {
  const failed = failedPageScores(404, 'HTTP 404');
  assert.equal(failed.seoScore, 0);
  assert.equal(failed.issues[0].detail, 'HTTP 404');
});

test('blockedAiCrawlers reads robots.txt groups', () => {
  const robots = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart';
  assert.deepEqual(blockedAiCrawlers(robots), ['GPTBot', 'ClaudeBot', 'CCBot']);
  assert.deepEqual(blockedAiCrawlers('User-agent: *\nDisallow: /'), ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot']);
  assert.deepEqual(blockedAiCrawlers('User-agent: *\nAllow: /'), []);
  const checks = buildSiteChecks({ robots: 'User-agent: GPTBot\nDisallow: /', llmsTxt: false, sitemapPages: 10, hasOrganizationSchema: true });
  assert.equal(checks.find((check) => check.id === 'ai-crawlers')?.pass, false);
});

test('parseSitemap reads index and url sets', () => {
  const index = parseSitemap('<sitemapindex><sitemap><loc>https://x.com/a.xml?from=1&amp;to=2</loc></sitemap></sitemapindex>');
  assert.deepEqual(index.sitemaps, ['https://x.com/a.xml?from=1&to=2']);
  const urls = parseSitemap('<urlset><url><loc>https://x.com/p</loc><lastmod>2026-01-02T00:00:00Z</lastmod></url></urlset>');
  assert.deepEqual(urls.pages, [{ url: 'https://x.com/p', lastModified: '2026-01-02' }]);
});

const site: Record<string, { status?: number; body: string; type?: string }> = {
  'https://x.com/sitemap.xml': { body: '<sitemapindex><sitemap><loc>https://x.com/s1.xml</loc></sitemap></sitemapindex>' },
  'https://x.com/s1.xml': { body: '<urlset><url><loc>https://x.com/products/a</loc></url><url><loc>https://x.com/products/missing</loc></url><url><loc>https://other.com/x</loc></url></urlset>' },
  'https://x.com/robots.txt': { body: 'User-agent: *\nAllow: /', type: 'text/plain' },
  'https://x.com/products/a': { body: GOOD_PRODUCT, type: 'text/html' },
  'https://x.com/': { body: '<html><head><title>Home</title></head><body></body></html>', type: 'text/html' },
};
const fakeFetch: Fetcher = async (url) => {
  const hit = site[url];
  return {
    ok: !!hit && (hit.status ?? 200) < 400,
    status: hit ? hit.status ?? 200 : 404,
    headers: new Headers({ 'content-type': hit?.type ?? 'application/xml' }),
    text: async () => hit?.body ?? '',
  };
};

test('discoverPages follows the index, stays on the site and adds the home page', async () => {
  const pages = await discoverPages('https://x.com', fakeFetch);
  assert.deepEqual(pages.map((page) => page.url).sort(), ['https://x.com/', 'https://x.com/products/a', 'https://x.com/products/missing']);
});

test('runSeoAudit stores every page, scores failures as zero and finishes the run', async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (/INSERT INTO seo_audit_runs/.test(sql)) return { rows: [{ id: 7 }] };
      if (/avg\(seo_score\)/.test(sql)) return { rows: [{ pages: 3, seo: 50, aio: 40 }] };
      return { rows: [] };
    },
  };
  const runId = await runSeoAudit(db, { siteUrl: 'https://x.com', fetcher: fakeFetch, concurrency: 2, delayMs: 0 });
  assert.equal(runId, 7);
  const pages = calls.filter((call) => /INSERT INTO seo_pages/.test(call.sql));
  assert.equal(pages.length, 3);
  const missing = pages.find((call) => call.values[0] === 'https://x.com/products/missing');
  assert.equal(missing?.values[10], 0);
  const finish = calls.find((call) => /UPDATE seo_audit_runs SET status = \$2/.test(call.sql));
  assert.equal(finish?.values[1], 'completed');
  assert.ok(calls.some((call) => /DELETE FROM seo_pages/.test(call.sql)));
});

test('runSeoAudit does nothing while another run is active', async () => {
  const db = { query: async (sql: string) => ({ rows: /SELECT 1 FROM seo_audit_runs/.test(sql) ? [{ '?column?': 1 }] : [] }) };
  assert.equal(await runSeoAudit(db, { siteUrl: 'https://x.com', fetcher: fakeFetch }), null);
});

test('runSeoAudit retries 429 responses (honouring Retry-After) before scoring a page', async () => {
  let hits = 0;
  const flaky: Fetcher = async (url, init) => {
    if (url === 'https://x.com/products/a' && hits++ < 2) {
      return { ok: false, status: 429, headers: new Headers({ 'retry-after': '0' }), text: async () => '' };
    }
    return fakeFetch(url, init);
  };
  const stored: Array<{ url: unknown; status: unknown; seo: unknown }> = [];
  const db = {
    query: async (sql: string, values: unknown[] = []) => {
      if (/INSERT INTO seo_audit_runs/.test(sql)) return { rows: [{ id: 9 }] };
      if (/INSERT INTO seo_pages/.test(sql)) stored.push({ url: values[0], status: values[2], seo: values[10] });
      return { rows: [] };
    },
  };
  await runSeoAudit(db, { siteUrl: 'https://x.com', fetcher: flaky, delayMs: 0 });
  const page = stored.find((row) => row.url === 'https://x.com/products/a');
  assert.equal(page?.status, 200);
  assert.ok(Number(page?.seo) > 80);
});
