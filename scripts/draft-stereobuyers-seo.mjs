// Drafts SEO title/description for Stereobuyers product pages with Claude.
// Usage: node --env-file=.env.local scripts/draft-stereobuyers-seo.mjs [--limit N] [--apply] [--out file]
// Without --apply it only writes drafts to the review JSON. With --apply it inserts
// seo_title / seo_description front matter into the product files from that JSON.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const ROOT = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const OUT = val('--out', 'docs/seo-snapshots/stereobuyers-seo-drafts.json');
const LIMIT = Number(val('--limit', '0'));
const MODEL = 'claude-haiku-4-5';

function listProducts() {
  const files = [];
  for (const brand of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, brand);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (/\.(md|html)$/.test(f)) files.push(path.join(dir, f));
  }
  return files.sort();
}

function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  let fm;
  try { fm = yaml.load(m[1]); } catch { return null; }
  if (!fm || fm.snippet !== 'product' || !fm.component) return null;
  return { fm, text, fmEnd: m[0].length };
}

async function draft(fm, tries = 6, hint = '') {
  const d = await draftOnce(fm, hint);
  const ok = d.title.length <= 60 && d.description.length >= 110 && d.description.length <= 157;
  if (ok || tries <= 1) return ok ? d : { ...d, error: `length ${d.title.length}/${d.description.length}` };
  return draft(fm, tries - 1, `Previous attempt was title ${d.title.length} chars and description ${d.description.length} chars. Be much shorter: title under 55, description 120-145.`);
}

async function draftOnce(fm, hint = '') {
  const specs = (fm.specs || []).slice(0, 8).map((s) => `${s.n}: ${s.v}`).join('; ');
  const prompt = `Write SEO metadata for a page on StereoBuyers, a Brooklyn, NY business that buys used high-end audio equipment. The page invites people to sell this item to StereoBuyers.

Brand: ${fm.brand}
Model: ${fm.component}
Type: ${fm.type || 'unknown'}
Manufacturer blurb: ${String(fm.description || '').replace(/\s+/g, ' ').slice(0, 500)}
Specs: ${specs || 'none'}

Rules:
- title: 45-60 characters, starts with "Sell ${fm.brand} ${fm.component}" or similar, includes the product type if known, ends with " | StereoBuyers" only if it fits.
- description: 130-155 characters, plain text, mentions the item, one concrete fact from the blurb/specs only if clearly stated there, and a call to action about a free quote from a Brooklyn buyer.
- Hard limit: description must be at most 155 characters including spaces. Count carefully.
- Do not invent specs, prices, speed, or claims (no "fast", "fair", "best"). No quotes, no emoji.
${hint}
Reply with JSON only: {"title": "...", "description": "..."}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const body = await res.json();
  const raw = body.content?.[0]?.text || '';
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  return { title: String(j.title).trim(), description: String(j.description).trim() };
}

if (flag('--apply')) {
  const drafts = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  let n = 0;
  for (const d of drafts) {
    if (!d.title || !d.description || d.error || d.approved === false) continue;
    const file = path.join(SITE, d.file);
    const p = parse(file);
    if (!p || p.fm.seo_description) continue;
    const ins = `seo_title: ${JSON.stringify(d.title)}\nseo_description: ${JSON.stringify(d.description)}\n`;
    const out = p.text.replace(/^(---\n)/, `$1${ins}`);
    fs.writeFileSync(file, out);
    n++;
  }
  console.log(`applied ${n}`);
} else {
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
  if (flag('--retry-errors')) existing = existing.filter((d) => !d.error);
  const done = new Set(existing.map((d) => d.file));
  const out = [...existing];
  let count = 0;
  for (const file of listProducts()) {
    const rel = path.relative(SITE, file);
    if (done.has(rel)) continue;
    const p = parse(file);
    if (!p) continue;
    if (LIMIT && count >= LIMIT) break;
    try {
      const d = await draft(p.fm);
      out.push({ file: rel, brand: p.fm.brand, component: p.fm.component, ...d });
    } catch (e) {
      out.push({ file: rel, brand: p.fm.brand, component: p.fm.component, error: String(e.message) });
    }
    count++;
    if (count % 20 === 0) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`drafted ${count}, total ${out.length}`);
}
