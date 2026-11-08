// Fixes SEO titles/descriptions on Shopify blog posts and pages that the latest audit snapshot flags. Dry-run unless --apply.
// They are stored in the global.title_tag / global.description_tag metafields, so the visible title and body are untouched.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-shopify-seo-content.ts [--apply] [--snapshot path] [--csv path]
import fs from 'node:fs';
import { generateContentSeoDescription, generateContentSeoTitle } from '../aws/src/providers/ai/client.js';
import { SEO_DESCRIPTION_RANGE, SEO_TITLE_RANGE } from '../aws/src/providers/shopify/seoFill.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const argValue = (name: string, fallback: string) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const snapshotPath = argValue('--snapshot', 'docs/seo-snapshots/2026-11-08-seo-backfill.json');
const csvPath = argValue('--csv', 'docs/seo-snapshots/seo-content-dryrun.csv');
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
// A shortened title may only use words the original title already had.
const usesOnlyOriginalWords = (candidate: string, original: string) => {
  const allowed = new Set(words(original));
  return words(candidate).every((w) => allowed.has(w));
};
const SUFFIX = ' | Resolution Audio Video';
const REFUSAL = /\b(I need|I can't|I cannot|Please provide|Let me)\b/i;
const domain = process.env.VITE_SHOPIFY_STORE_DOMAIN;
const token = process.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;
if (!domain || !token) throw new Error('Missing Shopify env vars');
const endpoint = `https://${domain}/admin/api/2025-01/graphql.json`;
const inRange = (text: string, range: { min: number; max: number }) => text.length >= range.min && text.length <= range.max;
const strip = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;/g, ' ').replace(/\s+/g, ' ').trim();
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(endpoint, { method: 'POST', headers: { 'X-Shopify-Access-Token': token!, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (!body.data) throw new Error(`GraphQL error: ${JSON.stringify(body.errors).slice(0, 300)}`);
  return body.data;
}

interface Node { id: string; title: string; handle: string; body: string; blog?: { handle: string }; t: { value: string } | null; d: { value: string } | null }
interface SnapshotPage { url: string; pageType?: string; page_type?: string; issues: Array<{ id: string }> }

async function fetchAll(field: 'articles' | 'pages'): Promise<Node[]> {
  const nodes: Node[] = [];
  let cursor: string | null = null;
  do {
    const blog = field === 'articles' ? 'blog{handle}' : '';
    const data: Record<string, { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: Node[] }> = await gql(
      `query($c:String){${field}(first:100,after:$c){pageInfo{hasNextPage endCursor}nodes{id title handle body ${blog} t:metafield(namespace:"global",key:"title_tag"){value} d:metafield(namespace:"global",key:"description_tag"){value}}}}`, { c: cursor });
    nodes.push(...data[field].nodes);
    cursor = data[field].pageInfo.hasNextPage ? data[field].pageInfo.endCursor : null;
  } while (cursor);
  return nodes;
}

async function setMetafield(ownerId: string, key: string, value: string): Promise<string | null> {
  const res: { metafieldsSet: { userErrors: Array<{ message: string }> } } = await gql(
    'mutation($m:[MetafieldsSetInput!]!){metafieldsSet(metafields:$m){userErrors{message}}}',
    { m: [{ ownerId, namespace: 'global', key, type: 'single_line_text_field', value }] });
  return res.metafieldsSet.userErrors[0]?.message ?? null;
}

async function main() {
  const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { pages?: SnapshotPage[] } | SnapshotPage[];
  const flagged = new Map<string, Set<string>>();
  for (const p of Array.isArray(snap) ? snap : snap.pages ?? []) {
    const ids = new Set(p.issues.map((i) => i.id).filter((id) => id === 'title-length' || id === 'description-length'));
    if (ids.size) flagged.set(new URL(p.url).pathname, ids);
  }

  const items: Array<{ kind: string; node: Node; path: string }> = [];
  for (const node of await fetchAll('articles')) items.push({ kind: 'blog', node, path: `/blogs/${node.blog!.handle}/${node.handle}` });
  for (const node of await fetchAll('pages')) items.push({ kind: 'page', node, path: `/pages/${node.handle}` });

  const rows = ['kind,path,old_title,new_title,old_description,new_description'];
  let changed = 0; let failed = 0;
  for (const { kind, node, path } of items) {
    const need = flagged.get(path);
    if (!need) continue;
    const oldTitle = (node.t?.value ?? '').trim();
    const oldDescription = (node.d?.value ?? '').trim();
    const text = strip(node.body).slice(0, 800);
    const facts = { 'Page type': kind === 'blog' ? 'Blog post' : 'Content page', 'Current title': node.title, Text: text };

    let title = oldTitle;
    if (need.has('title-length')) {
      const current = oldTitle || node.title;
      if (current.length < SEO_TITLE_RANGE.min && inRange(`${current}${SUFFIX}`, SEO_TITLE_RANGE)) title = `${current}${SUFFIX}`;
      else {
        try { const t = await generateContentSeoTitle(facts, current); if (inRange(t, SEO_TITLE_RANGE) && !REFUSAL.test(t) && usesOnlyOriginalWords(t, current)) title = t; } catch (e) { console.error(`AI title failed for ${path}: ${(e as Error).message}`); }
      }
    }
    let description = oldDescription;
    if (need.has('description-length')) {
      try { const d = await generateContentSeoDescription(facts, oldDescription); if (inRange(d, SEO_DESCRIPTION_RANGE) && !REFUSAL.test(d)) description = d; } catch (e) { console.error(`AI description failed for ${path}: ${(e as Error).message}`); }
    }
    if (title === oldTitle && description === oldDescription) { console.log(`SKIP ${path} (no valid value generated)`); continue; }
    changed += 1;
    rows.push([kind, path, oldTitle || node.title, title, oldDescription, description].map(csvCell).join(','));
    console.log(`${apply ? 'SET ' : 'DRY '} ${path}\n   title: ${node.title} -> ${title === oldTitle ? '(unchanged)' : `${title} [${title.length}]`}\n   desc : ${description === oldDescription ? '(unchanged)' : `${description} [${description.length}]`}`);
    if (!apply) continue;
    // Each metafield is its own write, so changing one never clears the other.
    const errors: Array<string | null> = [];
    if (title !== oldTitle) errors.push(await setMetafield(node.id, 'title_tag', title));
    if (description !== oldDescription) errors.push(await setMetafield(node.id, 'description_tag', description));
    const error = errors.find(Boolean);
    if (error) { failed += 1; console.error(`FAILED ${path}: ${error}`); }
  }
  fs.writeFileSync(csvPath, `${rows.join('\n')}\n`);
  console.log(`\n${apply ? 'Applied' : 'Dry run'}: ${flagged.size} flagged pages, ${changed} changes${apply ? `, ${failed} failed` : ''}. Review: ${csvPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
