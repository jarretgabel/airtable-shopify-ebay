// Fills blank image alt text on Shopify products. Dry-run unless --apply is passed.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-shopify-alt.ts [--apply] [--vision] [--limit N] [--product ID] [--status active]
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argValue = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const vision = args.includes('--vision');
const onlyProduct = argValue('--product', '');
const limit = Number(argValue('--limit', '0')) || Infinity;
const status = argValue('--status', 'active');

const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
if (!domain || !token) throw new Error('Missing Shopify env vars');
const base = `https://${domain}/admin/api/2024-04`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function shopify(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, { ...init, headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' } });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    return res;
  }
  throw new Error(`Rate limited: ${url}`);
}

interface Img { id: number; alt: string | null; position: number; src: string }
interface Product { id: number; title: string; images: Img[] }

const altFor = (title: string, position: number) => (position <= 1 ? title : `${title} - image ${position}`).trim();

const anthropicKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

async function visionAlt(title: string, img: Img): Promise<string | null> {
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is required for --vision');
  const imageRes = await fetch(img.src);
  if (!imageRes.ok) return null;
  const mediaType = (imageRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const data = Buffer.from(await imageRes.arrayBuffer()).toString('base64');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 80,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: `Write alt text for this product photo of "${title}" (used hi-fi audio gear for sale). Start with the product name, then briefly say what this photo shows (e.g. front panel, rear panel with inputs, top view, side, remote, box). Max 110 characters. Only describe what is visible; do not claim condition or specs you cannot see. No quotes, no "image of". Reply with the alt text only.` },
        ],
      }],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = body.content?.[0]?.text?.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').replace(/\.$/, '');
  return text && text.length <= 125 ? text : null;
}

async function main() {
  let url: string | null = onlyProduct
    ? `${base}/products.json?ids=${onlyProduct}&fields=id,title,images`
    : `${base}/products.json?limit=100&status=${status}&fields=id,title,images`;
  let products = 0, images = 0, updated = 0, failed = 0;
  outer: while (url) {
    const res = await shopify(url);
    if (!res.ok) throw new Error(`List failed: ${res.status}`);
    const body = (await res.json()) as { products: Product[] };
    for (const p of body.products) {
      const blanks = p.images.filter((img) => !img.alt || !img.alt.trim());
      if (!blanks.length || !p.title.trim()) continue;
      if (products >= limit) break outer;
      products += 1;
      for (const img of blanks) {
        const alt = (vision ? await visionAlt(p.title, img) : null) ?? altFor(p.title, img.position);
        images += 1;
        console.log(`${apply ? 'SET ' : 'DRY '} ${p.id}/${img.id}: ${alt}`);
        if (!apply) continue;
        const put = await shopify(`${base}/products/${p.id}/images/${img.id}.json`, { method: 'PUT', body: JSON.stringify({ image: { id: img.id, alt } }) });
        if (put.ok) updated += 1; else { failed += 1; console.error(`FAILED ${p.id}/${img.id}: ${put.status}`); }
        await sleep(550);
      }
    }
    const link = res.headers.get('link') ?? '';
    url = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null;
    await sleep(550);
  }
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${products} products, ${images} blank images${apply ? `, ${updated} updated, ${failed} failed` : ''}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
