// Fills blank or out-of-range Shopify SEO titles/descriptions using the app's AI generators. Dry-run unless --apply.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-shopify-seo.ts [--apply] [--limit N] [--product ID] [--csv path]
import fs from 'node:fs';
import { generateSeoDescription, generateSeoTitle } from '../aws/src/providers/ai/client.js';
import { SEO_DESCRIPTION_RANGE, SEO_TITLE_RANGE } from '../aws/src/providers/shopify/seoFill.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argValue = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const limit = Number(argValue('--limit', '0')) || Infinity;
const onlyProduct = argValue('--product', '');
const csvPath = argValue('--csv', 'docs/seo-snapshots/seo-backfill-dryrun.csv');

const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
if (!domain || !token) throw new Error('Missing Shopify env vars');
const endpoint = `https://${domain}/admin/api/2024-04/graphql.json`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    const body = (await res.json()) as { data?: T; errors?: unknown };
    if (!body.data) throw new Error(`GraphQL error: ${JSON.stringify(body.errors).slice(0, 300)}`);
    return body.data;
  }
  throw new Error('Rate limited');
}

interface ProductNode { id: string; title: string; vendor: string; productType: string; tags: string[]; descriptionHtml: string; seo: { title: string | null; description: string | null } }
const inRange = (v: string, r: { min: number; max: number }) => v.length >= r.min && v.length <= r.max;
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim();
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

async function main() {
  const rows: string[] = ['product_id,handle_title,old_seo_title,new_seo_title,old_seo_description,new_seo_description'];
  let cursor: string | null = null;
  let seen = 0, changed = 0, updated = 0, failed = 0;
  do {
    const data: { products: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: ProductNode[] } } = await gql(
      `query($cursor:String,$q:String){products(first:50,after:$cursor,query:$q){pageInfo{hasNextPage endCursor}nodes{id title vendor productType tags descriptionHtml seo{title description}}}}`,
      { cursor, q: onlyProduct ? `id:${onlyProduct}` : 'status:active' },
    );
    for (const p of data.products.nodes) {
      if (seen >= limit) { cursor = null; break; }
      seen += 1;
      const effectiveTitle = (p.seo.title ?? '').trim() || p.title;
      const currentDescription = (p.seo.description ?? '').trim();
      const needTitle = !inRange(effectiveTitle, SEO_TITLE_RANGE);
      const needDescription = !inRange(currentDescription, SEO_DESCRIPTION_RANGE);
      if (!needTitle && !needDescription) continue;

      const facts: Record<string, string> = { Title: p.title, Brand: p.vendor, 'Product Type': p.productType, Tags: p.tags.join(', '), Description: strip(p.descriptionHtml).slice(0, 600) };
      let newTitle = '', newDescription = '';
      try {
        if (needTitle) { const t = await generateSeoTitle(facts, (p.seo.title ?? '').trim()); if (inRange(t, SEO_TITLE_RANGE)) newTitle = t; }
        if (needDescription) { const d = await generateSeoDescription(facts, currentDescription); if (inRange(d, SEO_DESCRIPTION_RANGE)) newDescription = d; }
      } catch (e) { console.error(`AI failed for ${p.id}: ${(e as Error).message}`); }
      if (!newTitle && !newDescription) continue;
      changed += 1;
      rows.push([p.id.split('/').pop()!, p.title, p.seo.title ?? '', newTitle, currentDescription, newDescription].map(csvCell).join(','));
      console.log(`${apply ? 'SET ' : 'DRY '} ${p.title}\n   title: ${newTitle || '(unchanged)'} [${newTitle.length}]\n   desc : ${newDescription || '(unchanged)'} [${newDescription.length}]`);
      if (!apply) continue;
      const seo: Record<string, string> = {};
      if (newTitle) seo.title = newTitle;
      if (newDescription) seo.description = newDescription;
      try {
        const res: { productUpdate: { userErrors: Array<{ message: string }> } } = await gql(
          'mutation($input:ProductInput!){productUpdate(input:$input){userErrors{message}}}',
          { input: { id: p.id, seo } },
        );
        if (res.productUpdate.userErrors.length) { failed += 1; console.error(`FAILED ${p.id}: ${res.productUpdate.userErrors[0].message}`); } else updated += 1;
      } catch (e) { failed += 1; console.error(`FAILED ${p.id}: ${(e as Error).message}`); }
      await sleep(300);
    }
    if (cursor !== null || seen < limit) cursor = data.products.pageInfo.hasNextPage && seen < limit ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  fs.writeFileSync(csvPath, `${rows.join('\n')}\n`);
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${seen} products checked, ${changed} need changes${apply ? `, ${updated} updated, ${failed} failed` : ''}. Review: ${csvPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
