import { type ApprovalFieldMap } from './approvalShared.js';

export function parseCategoryIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    return raw.map((item) => String(item ?? '').trim()).filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const text = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parseCategoryIds(parsed);
  } catch {
    // Fall through.
  }

  const seen = new Set<string>();
  return text.split(/[\n,;|]/).map((item) => item.trim()).filter((value) => {
    if (!value) return false;
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isGenericCategoryFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('categor')) return false;
  if (normalized.includes('shopify') || normalized.includes('google') || normalized.includes('taxonomy') || normalized.includes('product type')) return false;
  return normalized === 'categories'
    || normalized === 'category'
    || normalized === 'categories airtable'
    || normalized === 'category airtable'
    || normalized === 'category ids'
    || normalized === 'category id'
    || normalized === 'category_ids'
    || normalized === 'category_id'
    || normalized === 'primary category'
    || normalized === 'secondary category'
    || normalized === 'primary category airtable'
    || normalized === 'secondary category airtable'
    || normalized === 'primary category id'
    || normalized === 'secondary category id'
    || normalized === 'primary_category'
    || normalized === 'secondary_category'
    || normalized === 'primary_category_id'
    || normalized === 'secondary_category_id'
    || normalized.includes('ebay')
    || normalized.includes('airtable')
    || normalized.includes('linked');
}

export function parseCategoryIdsFromFields(fields: ApprovalFieldMap): string[] {
  return Object.entries(fields)
    .filter(([fieldName]) => isGenericCategoryFieldName(fieldName))
    .flatMap(([, value]) => parseCategoryIds(value));
}