// Second pass: for brands with no Wikipedia match, ground a short paraphrased overview in the brand's own site.
// Haiku proposes the official domain; we fetch it, verify it mentions the brand, then paraphrase ONLY from fetched text.
// Usage: node --env-file=.env.local scripts/enrich-stereobuyers-brand-pages.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const BASE = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const CACHE = 'docs/seo-snapshots/stereobuyers-brand-profiles.json';
const MODEL = 'claude-haiku-4-5';
const APPLY = process.argv.includes('--apply');
const UA = 'Mozilla/5.0 (compatible; stereobuyers-seo/1.0; +https://www.stereobuyers.com)';
const cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));

async function claude(prompt, max = 600) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: max, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  return (await r.json()).content[0].text;
}

const textOf = (html) => html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&[#a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) return null;
    return { url: r.url, html: await r.text() };
  } catch { return null; }
}

const shingles = (s, n = 7) => { const w = s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); const o = new Set(); for (let i = 0; i + n <= w.length; i++) o.add(w.slice(i, i + n).join(' ')); return o; };
const nums = (s) => (s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, ''));

async function enrich(name) {
  const dom = (await claude(`What is the official website domain of the audio equipment brand "${name}" (hi-fi / high-end audio / cables / speakers / electronics)? Reply with JSON only: {"url": "https://..."} or {"url": null} if you are not confident.`, 100)).match(/\{[\s\S]*\}/);
  if (!dom) return null;
  const root = JSON.parse(dom[0]).url;
  if (!root || !/^https?:\/\//.test(root)) return null;
  const origin = new URL(root).origin;
  const pages = [];
  for (const p of ['/about', '/about-us', '/company', '/history', '/our-story', '/about-us/', '/pages/about-us', '']) {
    const g = await get(origin + p);
    if (g) { const t = textOf(g.html); if (t.length > 300) pages.push({ url: g.url, text: t }); }
    if (pages.length >= 2) break;
  }
  if (!pages.length) return null;
  const token = name.replace(/\(.*?\)/g, '').split(/[ .\-]/)[0].toLowerCase();
  if (!pages.some((p) => p.text.toLowerCase().includes(token))) return null;
  const src = pages.map((p) => `URL: ${p.url}\n${p.text.slice(0, 5000)}`).join('\n\n');
  const out = (await claude(`Brand: "${name}". Below is text from what should be its official website.
Write a 2-3 sentence factual overview of the company/brand IN YOUR OWN WORDS, using ONLY facts clearly stated in the text (what they make, where they are based, when founded, notable approach). Do not copy phrases of more than 5 consecutive words. No marketing language, no superlatives, no pricing. If the text does not clearly describe this audio brand, or has too few concrete facts, answer null.
Reply with JSON only: {"history": string|null, "url": string}  (url = the page URL the facts came from)

${src}`)).match(/\{[\s\S]*\}/);
  if (!out) return null;
  const j = JSON.parse(out[0]);
  if (!j.history) return null;
  const all = pages.map((p) => p.text).join(' ');
  if (nums(j.history).some((n) => !all.includes(n))) return null;
  const sh = shingles(all, 7);
  if ([...shingles(j.history, 7)].some((x) => sh.has(x))) return null;
  return { history: j.history.trim(), source: pages.find((p) => p.url === j.url)?.url || pages[0].url, sourceLabel: `${name} official website` };
}

const todo = Object.entries(cache).filter(([, v]) => !v.history && !v.tried2);
let ok = 0;
for (const [slug, v] of todo) {
  try { const r = await enrich(v.name); if (r) { Object.assign(v, r); ok++; } } catch (e) { v.error2 = e.message; }
  v.tried2 = true;
  process.stdout.write(v.history ? '+' : '.');
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
}
console.log(`\nenriched ${ok} of ${todo.length}`);

if (APPLY) {
  for (const [slug, v] of Object.entries(cache)) {
    if (!v.history || !v.sourceLabel) continue;
    const f = path.join(BASE, `${slug}.html`);
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    s = s.replace(/noindex: true\nsitemap: false\n/, '');
    if (!s.includes('history:')) s = s.replace(/\n---\n$/, `\nhistory: ${JSON.stringify(v.history)}\nhistory_source: ${JSON.stringify(v.source)}\nhistory_source_label: ${JSON.stringify(v.sourceLabel)}\n---\n`);
    fs.writeFileSync(f, s);
  }
}
