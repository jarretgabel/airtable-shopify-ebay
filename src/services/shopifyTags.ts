export const SHOPIFY_DEFAULT_VENDOR = 'Resolution Audio Video NYC';

function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ');
}

export function dedupeShopifyTags(tags: string[]): string[] {
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

function parseTagArray(values: unknown[]): string[] {
  const tags: string[] = [];

  values.forEach((value) => {
    if (typeof value === 'string') {
      tags.push(value);
      return;
    }

    if (!value || typeof value !== 'object') return;

    const record = value as Record<string, unknown>;
    const candidate = record.name ?? record.tag ?? record.value;
    if (typeof candidate === 'string') {
      tags.push(candidate);
    }
  });

  return dedupeShopifyTags(tags);
}

export function parseShopifyTagList(raw: unknown): string[] {
  if (Array.isArray(raw)) return parseTagArray(raw);
  if (raw === null || raw === undefined) return [];

  if (typeof raw !== 'string') {
    return dedupeShopifyTags([String(raw)]);
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parseTagArray(parsed);
    }
  } catch {
    // Fall through to comma/newline parsing.
  }

  return dedupeShopifyTags(trimmed.split(/[\n,]/).map((tag) => tag.trim()));
}

export function serializeShopifyTagsCsv(tags: string[]): string {
  return dedupeShopifyTags(tags).join(', ');
}

export function serializeShopifyTagsJson(tags: string[]): string {
  return JSON.stringify(dedupeShopifyTags(tags));
}