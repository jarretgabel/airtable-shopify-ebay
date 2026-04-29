import type { ApprovalFieldMap } from './approvalDraftTypes.js';
import { getField, getRawField } from './approvalDraftFieldUtils.js';

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ');
}

function dedupeShopifyTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  tags.forEach((tag) => {
    const cleaned = normalizeTag(tag);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(cleaned);
  });
  return normalized;
}

export function parseShopifyTagList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return dedupeShopifyTags(raw.map((value) => String(value ?? '')).filter(Boolean));
  }
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== 'string') return dedupeShopifyTags([String(raw)]);
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return dedupeShopifyTags(parsed.map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          return String(record.name ?? record.tag ?? record.value ?? '');
        }
        return '';
      }).filter(Boolean));
    }
  } catch {
    // Fall through.
  }
  return dedupeShopifyTags(trimmed.split(/[\n,]/).map((tag) => tag.trim()));
}

export function serializeShopifyTagsCsv(tags: string[]): string {
  return dedupeShopifyTags(tags).join(', ');
}

function buildTags(fields: ApprovalFieldMap): string | undefined {
  const tagsFromSingles: string[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const tag = getField(fields, [`Shopify REST Tag ${i}`, `Shopify Tag ${i}`, `Shopify GraphQL Tag ${i}`, `Shopify Extra Tag ${i}`, `shopify_rest_tag_${i}`]);
    if (tag) tagsFromSingles.push(...parseShopifyTagList(tag));
  }
  const compound = getRawField(fields, ['Shopify REST Tags', 'Shopify Tags', 'Shopify GraphQL Tags', 'Shopify GraphQL Tags JSON', 'Tags', 'shopify_rest_tags', 'shopify_tags', 'shopify_graphql_tags', 'shopify_graphql_tags_json', 'tags']);
  const tagsFromCompound = parseShopifyTagList(compound);
  const serialized = serializeShopifyTagsCsv([...tagsFromSingles, ...tagsFromCompound]);
  return serialized.length > 0 ? serialized : undefined;
}

export function buildShopifyTagValuesFromApprovalFields(fields: ApprovalFieldMap): string[] {
  return parseShopifyTagList(buildTags(fields));
}

export { buildTags };