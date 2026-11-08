// Fixes out-of-range SEO titles/descriptions on Shopify collections. Dry-run unless --apply.
// Titles: "<collection title> | Resolution Audio Video" when that lands in 30-60 characters. Descriptions: AI, only when blank or out of range.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-shopify-seo-collections.ts [--apply]
import { generateCollectionSeoDescription } from '../aws/src/providers/ai/client.js';
import { SEO_DESCRIPTION_RANGE, SEO_TITLE_RANGE } from '../aws/src/providers/shopify/seoFill.js';

const apply = process.argv.includes('--apply');
const REFUSAL = /\b(I need|I can't|I cannot|Please provide|Let me)\b/i;
const SUFFIX = ' | Resolution Audio Video';
const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
if (!domain || !token) throw new Error('Missing Shopify env vars');
const endpoint = `https://${domain}/admin/api/2025-01/graphql.json`;
const inRange = (text: string, range: { min: number; max: number }) => text.length >= range.min && text.length <= range.max;
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (!body.data) throw new Error(`GraphQL error: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return body.data;
}

interface Collection { id: string; handle: string; title: string; descriptionHtml: string; seo: { title: string | null; description: string | null } }

async function main() {
  let cursor: string | null = null;
  let checked = 0; let changed = 0; let failed = 0;
  do {
    const data: { collections: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: Collection[] } } = await gql(
      'query($c:String){collections(first:50,after:$c){pageInfo{hasNextPage endCursor}nodes{id handle title descriptionHtml seo{title description}}}}', { c: cursor });
    for (const c of data.collections.nodes) {
      checked += 1;
      const currentTitle = (c.seo.title ?? '').trim();
      const currentDescription = (c.seo.description ?? '').trim();
      // The storefront title is the SEO title, or the collection title when that is blank.
      let title = currentTitle;
      if (!inRange(currentTitle || c.title, SEO_TITLE_RANGE)) {
        const candidate = `${c.title}${SUFFIX}`;
        if (inRange(candidate, SEO_TITLE_RANGE)) title = candidate;
      }
      let description = currentDescription;
      if (!inRange(currentDescription, SEO_DESCRIPTION_RANGE)) {
        try {
          const generated = await generateCollectionSeoDescription({ 'Collection title': c.title, 'Page type': 'Collection page', 'Collection text': strip(c.descriptionHtml).slice(0, 600) }, currentDescription);
          if (inRange(generated, SEO_DESCRIPTION_RANGE) && !REFUSAL.test(generated)) description = generated;
        } catch (e) { console.error(`AI failed for ${c.handle}: ${(e as Error).message}`); }
      }
      if (title === currentTitle && description === currentDescription) continue;
      changed += 1;
      console.log(`${apply ? 'SET ' : 'DRY '} ${c.handle}\n   title: ${title || '(blank)'} [${title.length}]${title === currentTitle ? ' (unchanged)' : ''}\n   desc : ${description} [${description.length}]${description === currentDescription ? ' (unchanged)' : ''}`);
      if (!apply) continue;
      // collectionUpdate replaces the whole seo object, so both fields are always sent.
      const res: { collectionUpdate: { userErrors: Array<{ message: string }> } } = await gql(
        'mutation($input:CollectionInput!){collectionUpdate(input:$input){userErrors{message}}}', { input: { id: c.id, seo: { title, description } } });
      if (res.collectionUpdate.userErrors.length) { failed += 1; console.error(`FAILED ${c.handle}: ${res.collectionUpdate.userErrors[0].message}`); }
    }
    cursor = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
  } while (cursor);
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${checked} collections checked, ${changed} need changes${apply ? `, ${failed} failed` : ''}.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
