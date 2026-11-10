// Drafts brand_intro / brand_buy copy for thin Stereobuyers brand pages.
// Usage: node --env-file=.env.local scripts/draft-stereobuyers-brand-copy.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const DIR = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const OUT = 'docs/seo-snapshots/stereobuyers-brand-copy-drafts.json';
const MODEL = process.env.DRAFT_MODEL || 'claude-sonnet-4-5';
const FILES = ['accuphase', 'bowers-and-wilkins', 'bryston', 'cary-audio', 'classe', 'devore-fidelity', 'rogue-audio', 'sme-turntables', 'sonus-faber', 'vpi-turntables'];

async function draft(brand) {
  const prompt = `Write copy for the "${brand}" brand page on StereoBuyers (stereobuyers.com), a Brooklyn, NY business that buys used high-end audio equipment, picks it up, and pays on the spot.

Return JSON only: {"intro": "...", "buy": "..."}
- intro: 2-3 sentences (55-80 words) about the ${brand} brand: where it is based, what it is known for, and what kinds of products it makes. Use only widely documented facts you are highly confident about. No founding years or model numbers unless you are certain. No superlatives such as "best", no awards.
- buy: 2 sentences (35-60 words) saying StereoBuyers is interested in used ${brand} equipment in the product categories the brand actually makes, in working or serviceable condition, and inviting a quote request. Do not claim StereoBuyers has bought any specific models, quantities or prices.
Plain text, no markdown, no quotes inside, no emoji.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status} ${await res.text()}`);
  const raw = (await res.json()).content?.[0]?.text || '';
  const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  return { intro: String(j.intro).trim(), buy: String(j.buy).trim() };
}

if (process.argv.includes('--apply')) {
  let n = 0;
  for (const d of JSON.parse(fs.readFileSync(OUT, 'utf8'))) {
    if (d.error || d.skip) continue;
    const file = path.join(DIR, `${d.file}.html`);
    const text = fs.readFileSync(file, 'utf8');
    if (/^brand_intro:/m.test(text)) continue;
    fs.writeFileSync(file, text.replace(/^---\n/, `---\nbrand_intro: ${JSON.stringify(d.intro)}\nbrand_buy: ${JSON.stringify(d.buy)}\n`));
    n++;
  }
  console.log(`applied ${n}`);
} else {
  const out = [];
  for (const f of FILES) {
    const brand = fs.readFileSync(path.join(DIR, `${f}.html`), 'utf8').match(/^brand: (.+)$/m)[1];
    try { out.push({ file: f, brand, ...(await draft(brand)) }); } catch (e) { out.push({ file: f, brand, error: e.message }); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`drafted ${out.length}, errors ${out.filter((d) => d.error).length}`);
}
