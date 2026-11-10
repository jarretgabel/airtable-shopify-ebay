// Drafts a short grounded blurb for Stereobuyers product pages with missing/short descriptions.
// Usage: node --env-file=.env.local scripts/draft-stereobuyers-product-blurbs.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const BASE = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const OUT = 'docs/seo-snapshots/stereobuyers-product-blurbs-drafts.json';
const MODEL = 'claude-haiku-4-5';

function targets() {
  const out = [];
  for (const d of fs.readdirSync(BASE)) {
    const dp = path.join(BASE, d);
    if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith('.md'))) {
      const text = fs.readFileSync(path.join(dp, f), 'utf8');
      const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
      if (!m) continue;
      let fm;
      try { fm = yaml.load(m[1]) || {}; } catch { continue; }
      if (fm.snippet !== 'product' || fm.blurb) continue;
      const words = String(fm.description || '').split(/\s+/).filter(Boolean).length;
      if (words < 25) out.push({ file: `${d}/${f}`, fm });
    }
  }
  return out;
}

async function draft(fm) {
  const specs = (Array.isArray(fm.specs) ? fm.specs : []).filter((s) => s && s.n).map((s) => `${s.n}: ${s.v}`).join('; ').slice(0, 900);
  const prompt = `Write a short product blurb for a page on StereoBuyers (a Brooklyn business that buys used high-end audio equipment) about the item below.

Item: ${fm.title || fm.component}
Type: ${fm.type || ''}
Existing note: ${fm.description || ''}
Specs: ${specs || 'none provided'}

Rules:
- 1-2 sentences, 30-55 words, plain text.
- Use ONLY facts in the item data above. No history, prices, years, features or praise that are not stated. No invented model details.
- Say what the item is and, if specs are given, mention one or two of them. Then say StereoBuyers is interested in buying this model used.
- No quotes, no emoji, no markdown.
Reply with the blurb only.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 250, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  return ((await res.json()).content?.[0]?.text || '').replace(/\s+/g, ' ').trim();
}

if (process.argv.includes('--apply')) {
  let n = 0;
  for (const d of JSON.parse(fs.readFileSync(OUT, 'utf8'))) {
    if (d.error || !d.blurb) continue;
    const file = path.join(BASE, d.file);
    const text = fs.readFileSync(file, 'utf8');
    if (/^blurb:/m.test(text.split('\n---')[0])) continue;
    fs.writeFileSync(file, text.replace(/^---\n/, `---\nblurb: ${JSON.stringify(d.blurb)}\n`));
    n++;
  }
  console.log(`applied ${n}`);
} else {
  const out = [];
  for (const t of targets()) {
    try { out.push({ file: t.file, title: t.fm.title, blurb: await draft(t.fm) }); } catch (e) { out.push({ file: t.file, error: e.message }); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`drafted ${out.length}, errors ${out.filter((d) => d.error).length}`);
}
