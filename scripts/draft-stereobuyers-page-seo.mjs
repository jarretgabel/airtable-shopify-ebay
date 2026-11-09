// Drafts seo_title/seo_description for non-product Stereobuyers pages (brand landing, blog, service area, info pages).
// Usage: node --env-file=.env.local scripts/draft-stereobuyers-page-seo.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const OUT = 'docs/seo-snapshots/stereobuyers-page-seo-drafts.json';
const MODEL = 'claude-haiku-4-5';
const INFO = ['faq.html', 'press.html', 'partners.html', 'contact.html', 'service-area.html', 'blog.html'];
const SKIP = new Set(['index.html', 'arp.html', 'stereophile.html']);

function targets() {
  const out = [];
  for (const f of fs.readdirSync(SITE)) {
    if (!f.endsWith('.html') || SKIP.has(f)) continue;
    const fm = parse(f);
    if (!fm) continue;
    if (INFO.includes(f)) out.push({ file: f, kind: 'info page' });
    else if (fm.fm.layout === 'default' && fm.fm.slug === 'index') out.push({ file: f, kind: 'brand landing page (sell used equipment of this brand)' });
  }
  for (const d of ['_blog', '_service-area']) {
    for (const f of fs.readdirSync(path.join(SITE, d))) {
      if (f.endsWith('.md')) out.push({ file: `${d}/${f}`, kind: d === '_blog' ? 'blog post' : 'local service area page (free pickup)' });
    }
  }
  return out;
}

function parse(rel) {
  const text = fs.readFileSync(path.join(SITE, rel), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return null;
  try { return { fm: yaml.load(m[1]) || {}, body: text.slice(m[0].length), text }; } catch { return null; }
}

async function once(t, p, hint) {
  const body = p.body.replace(/\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1500);
  const prompt = `Write SEO metadata for a page on StereoBuyers (stereobuyers.com), a Brooklyn, NY business that buys used high-end audio equipment, picks it up, and pays on the spot.

Page type: ${t.kind}
Current title: ${p.fm.title || ''}
Current description: ${p.fm.description || ''}
Page text: ${body}
${p.fm.copy ? `Copy: ${String(p.fm.copy).slice(0, 600)}` : ''}

Rules:
- title: 40-58 characters, unique and specific to this page, ending with " | StereoBuyers" if it fits.
- description: 120-150 characters, plain text, specific to this page, with a call to action.
- Only state facts present above or stated in this prompt. No invented prices, awards, or guarantees. No quotes, no emoji.
${hint}
Reply with JSON only: {"title": "...", "description": "..."}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const raw = (await res.json()).content?.[0]?.text || '';
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  return { title: String(j.title).trim(), description: String(j.description).trim() };
}

async function draft(t, p, tries = 6, hint = '') {
  const d = await once(t, p, hint);
  const ok = d.title.length <= 60 && d.description.length >= 100 && d.description.length <= 155;
  if (ok) return d;
  if (tries <= 1) return { ...d, error: `length ${d.title.length}/${d.description.length}` };
  return draft(t, p, tries - 1, `Previous attempt was title ${d.title.length} chars, description ${d.description.length}. Title must be under 58, description 120-145.`);
}

if (process.argv.includes('--apply')) {
  let n = 0;
  for (const d of JSON.parse(fs.readFileSync(OUT, 'utf8'))) {
    if (d.error || !d.title) continue;
    const file = path.join(SITE, d.file);
    const text = fs.readFileSync(file, 'utf8');
    if (/^seo_description:/m.test(text.split('\n---')[0])) continue;
    fs.writeFileSync(file, text.replace(/^---\n/, `---\nseo_title: ${JSON.stringify(d.title)}\nseo_description: ${JSON.stringify(d.description)}\n`));
    n++;
  }
  console.log(`applied ${n}`);
} else {
  const out = [];
  for (const t of targets()) {
    const p = parse(t.file);
    try { out.push({ file: t.file, kind: t.kind, ...(await draft(t, p)) }); } catch (e) { out.push({ file: t.file, kind: t.kind, error: e.message }); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`drafted ${out.length}, errors ${out.filter((d) => d.error).length}`);
}
