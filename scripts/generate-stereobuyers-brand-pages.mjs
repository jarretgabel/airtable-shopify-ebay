// Generates brand pages for the Stereobuyers "brands we buy" list.
// History text is written by Claude Haiku ONLY from the matching Wikipedia summary; no match = no history (page stays noindex).
// Usage: node --env-file=.env.local scripts/generate-stereobuyers-brand-pages.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const BASE = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const CACHE = 'docs/seo-snapshots/stereobuyers-brand-profiles.json';
const MODEL = 'claude-haiku-4-5';
const APPLY = process.argv.includes('--apply');
const UA = 'stereobuyers-seo/1.0 (info@stereobuyers.com)';

const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Names that map onto an existing hand-written brand page or are duplicates of another list entry.
const ALIASES = {
  'bw': 'bowers-and-wilkins', 'classe-audio': 'classe', 'devore-fidelity': 'devore-fidelity', 'vpi-industries': 'vpi-turntables',
  'garrard-turntables': 'garrard-turntables', 'alstine-audio-by': 'audio-by-van-alstine', 'jeff-rowland': 'jeff-rowland-design-group',
};
const DISPLAY = { 'Alstine, Audio By': 'Audio by Van Alstine', 'Equi=Tech': 'Equi=Tech', 'Electro -Voice': 'Electro-Voice', 'Kimber - Kable': 'Kimber Kable', 'Jeff Rowland': 'Jeff Rowland Design Group' };

const OVERRIDE = { nakamichi: '/nakamichi/', 'garrard-turntables': '/garrard-turntables/' };
const data = yaml.load(fs.readFileSync(path.join(SITE, '_data/equipment.yml'), 'utf8'));
const existing = new Set(fs.readdirSync(BASE).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', '')));
['garrard-turntables', 'nakamichi'].forEach((s) => existing.add(s));

const brands = new Map();
for (const raw of data.brands) {
  const name = DISPLAY[raw] || raw;
  let slug = slugify(name);
  slug = ALIASES[slug] || slug;
  if (!brands.has(slug)) brands.set(slug, { name: ALIASES[slugify(name)] && existing.has(ALIASES[slugify(name)]) ? name : name, slug, existing: existing.has(slug) });
}

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

async function wiki(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  return r.ok ? r.json() : null;
}

async function candidates(name) {
  const q = encodeURIComponent(`${name} audio`);
  const s = await wiki(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json`);
  const out = [];
  for (const hit of s?.query?.search || []) {
    const sum = await wiki(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`);
    if (sum?.extract && sum.type === 'standard') out.push({ title: sum.title, url: sum.content_urls?.desktop?.page, extract: sum.extract });
  }
  return out;
}

async function claude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}`);
  const j = await r.json();
  return j.content[0].text;
}

const nums = (s) => (s.match(/\d[\d,.]*/g) || []).map((n) => n.replace(/[,.]$/, ''));

async function profile(name) {
  const cands = await candidates(name);
  if (!cands.length) return { history: null };
  const list = cands.map((c, i) => `[${i}] ${c.title}\n${c.extract}`).join('\n\n');
  const text = await claude(`Brand: "${name}" (a high-end/consumer audio equipment brand, e.g. amplifiers, speakers, turntables, cables, electronics).
Below are Wikipedia summaries. Pick the one that is clearly about THIS audio brand/company (not a person, place, or unrelated company). If none clearly matches, answer null.
If one matches, write a 2-3 sentence factual brand history/overview using ONLY facts stated in that summary. Do not add any fact, date, number or place not in the summary. Neutral tone, no marketing words, do not mention Wikipedia.
Reply with JSON only: {"index": number|null, "history": string|null}

${list}`);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { history: null };
  const j = JSON.parse(m[0]);
  if (j.index == null || !j.history || !cands[j.index]) return { history: null };
  const c = cands[j.index];
  if (nums(j.history).some((n) => !c.extract.includes(n))) return { history: null, rejected: 'number not in source' };
  return { history: j.history.trim(), source: c.url, sourceTitle: c.title };
}

const todo = [...brands.values()];
for (const b of todo) {
  if (b.existing || cache[b.slug]) continue;
  try { cache[b.slug] = { name: b.name, ...(await profile(b.name)) }; } catch (e) { cache[b.slug] = { name: b.name, history: null, error: String(e.message) }; }
  process.stdout.write('.');
}
fs.mkdirSync(path.dirname(CACHE), { recursive: true });
fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));

const q = (s) => JSON.stringify(s);
let withHist = 0, total = 0;
const map = {};
for (const raw of data.brands) { const n = DISPLAY[raw] || raw; const sl = slugify(n); const slg = ALIASES[sl] || sl; map[raw] = OVERRIDE[slg] || `/stereo-equipment-and-components-we-buy/${slg}/`; }
for (const b of todo) {
  if (b.existing) continue;
  total++;
  const p = cache[b.slug] || {};
  const has = !!p.history;
  if (has) withHist++;
  if (!APPLY) continue;
  const lines = ['---', 'layout: auto-brand', `title: ${q([`${b.name} – We Buy Used & Vintage Equipment`, `${b.name} – We Buy Used Equipment`, `We Buy Used ${b.name}`].find((t) => t.length <= 60))}`,
    `brand: ${q(b.name)}`, `description: ${q(`StereoBuyers buys used and vintage ${b.name} audio equipment. Get a free quote and cash paid on the spot in the NYC Tri-State Area, Palm Beach FL and Denver, Boulder and the Front Range.`)}`,
    `permalink: /stereo-equipment-and-components-we-buy/${b.slug}/`, 'page_class: brand-page auto-brand-page'];
  if (has) lines.push(`history: ${q(p.history)}`, `history_source: ${q(p.source)}`, `history_source_title: ${q(p.sourceTitle)}`);
  else lines.push('noindex: true', 'sitemap: false');
  lines.push('---', '');
  fs.writeFileSync(path.join(BASE, `${b.slug}.html`), lines.join('\n'));
}
if (APPLY) {
  fs.writeFileSync(path.join(SITE, '_data/brand_pages.yml'), yaml.dump(map, { lineWidth: -1 }));
}
console.log(`\nbrands: ${todo.length}, new pages: ${total}, with history: ${withHist}`);
