// Trims long review/quote/manufacturer descriptions on Stereobuyers product pages to a few key sentences (extractive only).
// Usage: node --env-file=.env.local scripts/trim-stereobuyers-quotes.mjs [--apply]
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const SITE = process.env.STEREOBUYERS_DIR || path.join(process.env.HOME, 'Sites/stereobuyers');
const BASE = path.join(SITE, 'stereo-equipment-and-components-we-buy');
const OUT = 'docs/seo-snapshots/stereobuyers-quote-trims.json';
const MODEL = 'claude-haiku-4-5';
const MAX_WORDS = 70;
const APPLY = process.argv.includes('--apply');

const wc = (s) => s.split(/\s+/).filter(Boolean).length;

function splitSentences(text) {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["”’']?|$)(?:\s+|$)/g) || [text];
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parse(desc) {
  const d = desc.trim();
  const first = d.search(/["“]/);
  const last = Math.max(d.lastIndexOf('"'), d.lastIndexOf('”'));
  if (first !== -1 && last > first) {
    return { prefix: d.slice(0, first + 1), body: d.slice(first + 1, last), suffix: d.slice(last), quoted: true };
  }
  const tail = d.match(/\s*(\\?\[[^\]]*\]\s*)$/);
  if (tail) return { prefix: '', body: d.slice(0, tail.index), suffix: ` ${tail[1].trim()}`, quoted: false };
  return { prefix: '', body: d, suffix: '', quoted: false };
}

async function pick(item, sentences) {
  const numbered = sentences.map((s, i) => `${i}: ${s}`).join('\n');
  const prompt = `Product: ${item.title || item.component}\n\nBelow are numbered sentences from a longer review or description. Pick the 2 or 3 sentences that best convey the key points about this product (sound or build quality, notable features, verdict). Total must be under ${MAX_WORDS} words. Prefer complete, self-contained sentences. Reply with ONLY a JSON array of the sentence numbers in order, e.g. [0,3].\n\n${numbered}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 60, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const m = (j.content?.[0]?.text || '').match(/\[[\d,\s]*\]/);
  if (!m) throw new Error('no json');
  return JSON.parse(m[0]).filter((n) => Number.isInteger(n) && n >= 0 && n < sentences.length);
}

function fallback(sentences) {
  const out = [];
  let words = 0;
  for (let i = 0; i < sentences.length && out.length < 3; i++) {
    const w = wc(sentences[i]);
    if (words + w > MAX_WORDS && out.length) break;
    out.push(i);
    words += w;
  }
  return out;
}

function targets() {
  const out = [];
  for (const d of fs.readdirSync(BASE)) {
    const dp = path.join(BASE, d);
    if (!fs.statSync(dp).isDirectory()) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith('.md'))) {
      const file = path.join(dp, f);
      const text = fs.readFileSync(file, 'utf8');
      const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
      if (!m) continue;
      let fm;
      try { fm = yaml.load(m[1]) || {}; } catch { continue; }
      if (fm.snippet !== 'product' || !fm.description) continue;
      const desc = String(fm.description);
      if (wc(desc) <= MAX_WORDS + 10) continue;
      if (/\*\*|\n\s*[*-] |<br>/.test(desc.trim()) && !/^["“]/.test(desc.trim())) { out.push({ file, rel: `${d}/${f}`, skip: 'markdown/list copy' }); continue; }
      out.push({ file, rel: `${d}/${f}`, fm, desc, fmText: m[1] });
    }
  }
  return out;
}

function replaceDescription(fmText, newDesc) {
  const lines = fmText.split('\n');
  const i = lines.findIndex((l) => /^description:/.test(l));
  let j = i + 1;
  while (j < lines.length && (/^\s/.test(lines[j]) || lines[j] === '')) j++;
  lines.splice(i, j - i, `description: ${JSON.stringify(newDesc)}`);
  return lines.join('\n');
}

const items = targets();
const results = [];
let idx = 0;
async function worker() {
  while (idx < items.length) {
    const it = items[idx++];
    if (it.skip) { results.push({ file: it.rel, skip: it.skip }); continue; }
    const { prefix, body, suffix } = parse(it.desc);
    const sentences = splitSentences(body);
    let picked;
    try { picked = await pick(it.fm, sentences); } catch { picked = []; }
    const tooLong = wc(picked.map((n) => sentences[n]).join(' ')) > MAX_WORDS + 15;
    if (!picked.length || tooLong) picked = fallback(sentences);
    const ok = (n) => wc(sentences[n]) >= 6 && /^[A-Z"“'‘0-9]/.test(sentences[n]);
    picked = [...new Set(picked)].filter(ok).sort((a, b) => a - b);
    if (!picked.length) picked = fallback(sentences.map((x, n) => (ok(n) ? x : ''))).filter(ok);
    let trimmed = '';
    picked.forEach((n, k) => { trimmed += (k && n !== picked[k - 1] + 1 ? ' … ' : k ? ' ' : '') + sentences[n]; });
    const next = `${prefix}${trimmed}${suffix}`.replace(/\s+/g, ' ').trim();
    const digitRatio = (next.match(/\d+/g) || []).length / Math.max(1, wc(next));
    results.push(wc(next) > MAX_WORDS + 25 || wc(next) < 20 || digitRatio > 0.15 ? { file: it.rel, skip: 'no good extract' } : { file: it.rel, before: wc(it.desc), after: wc(next), next, _it: it });
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

fs.writeFileSync(OUT, JSON.stringify(results.map(({ _it, ...r }) => r), null, 1));
const done = results.filter((r) => r.next);
console.log(`targets ${items.length}, trimmed ${done.length}, skipped ${results.length - done.length}`);
if (APPLY) {
  for (const r of done) {
    const it = r._it;
    const text = fs.readFileSync(it.file, 'utf8');
    const nf = replaceDescription(it.fmText, r.next);
    fs.writeFileSync(it.file, text.replace(it.fmText, () => nf));
  }
  console.log('applied');
}
