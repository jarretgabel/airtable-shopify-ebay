import { type ApprovalFieldMap } from './approvalShared.js';

function normalizeCategoryToken(token: string): string {
  return token
    .trim()
    .replace(/^['"[{(]+/, '')
    .replace(/['"})\]]+$/, '')
    .trim();
}

function extractNumericCategoryIds(text: string): string[] {
  const matches = text.match(/\b\d{3,}\b/g);
  return matches ? matches : [];
}

function looksLikeCategoryIdToken(token: string): boolean {
  return /^\d{3,}$/.test(token) || /^rec[a-zA-Z0-9]{14,}$/.test(token);
}

function parseCategoryIds(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    const values = raw.flatMap((item) => parseCategoryIds(item));
    const seen = new Set<string>();
    return values.filter((token) => {
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const direct = parseCategoryIds(
      record.categoryId
      ?? record.category_id
      ?? record.primaryCategoryId
      ?? record.primary_category_id
      ?? record.secondaryCategoryId
      ?? record.secondary_category_id
      ?? record.ebayCategoryId
      ?? record.ebay_category_id
      ?? record.id
      ?? record.name
      ?? record.title
      ?? record.value,
    );
    if (direct.length > 0) return direct;
    return Object.values(record).flatMap((value) => parseCategoryIds(value));
  }
  const text = String(raw).trim();
  if (!text) return [];
  const values: string[] = [];
  try {
    return parseCategoryIds(JSON.parse(text));
  } catch {
    text.split(/[\n,;|]/).forEach((token) => {
      const normalized = normalizeCategoryToken(token);
      if (normalized) values.push(normalized);
    });
    if (values.length === 0) {
      extractNumericCategoryIds(text).forEach((token) => values.push(token));
    }
  }
  const seen = new Set<string>();
  return values.filter((token) => {
    const key = token.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseCategoryNames(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    const values = raw.flatMap((item) => parseCategoryNames(item));
    const seen = new Set<string>();
    return values.filter((token) => {
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const direct = parseCategoryNames(
      record.categoryName
      ?? record.category_name
      ?? record.primaryCategoryName
      ?? record.primary_category_name
      ?? record.secondaryCategoryName
      ?? record.secondary_category_name
      ?? record.name
      ?? record.title
      ?? record.label
      ?? record.value,
    );
    if (direct.length > 0) return direct;
    return Object.values(record).flatMap((value) => parseCategoryNames(value));
  }
  const text = String(raw).trim();
  if (!text) return [];
  try {
    return parseCategoryNames(JSON.parse(text));
  } catch {
    const values = text.split(/[\n,;|]/).map((token) => normalizeCategoryToken(token)).filter((token) => token.length > 0 && !looksLikeCategoryIdToken(token));
    const seen = new Set<string>();
    return values.filter((token) => {
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function normalizeFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
}

function isEbayCategoriesField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  if (normalized === 'category' || normalized === 'categories' || normalized === 'category ids' || normalized === 'category_ids' || normalized === 'category id' || normalized === 'category_id') {
    return true;
  }
  if (normalized.includes('categor')) {
    if (normalized.includes('shopify') || normalized.includes('google') || normalized.includes('taxonomy') || normalized.includes('product type')) {
      return false;
    }
    return normalized.includes('ebay') || normalized.includes('id') || normalized.includes('json') || normalized.includes('primary') || normalized.includes('secondary') || normalized.includes('airtable') || normalized.includes('linked');
  }
  return false;
}

function isEbayPrimaryCategoryField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized === 'ebay offer primary category id'
    || normalized === 'ebay_offer_primary_category_id'
    || normalized === 'ebay_offer_primarycategoryid'
    || normalized === 'ebay offer category id'
    || normalized === 'ebay_offer_category_id'
    || normalized === 'ebay_offer_categoryid'
    || normalized === 'category id'
    || normalized === 'category_id'
    || normalized === 'primary category id'
    || normalized === 'primary_category_id'
    || normalized === 'primary category'
    || normalized === 'primary_category'
    || normalized === 'primary category airtable'
    || normalized === 'primary_category_airtable';
}

function isEbaySecondaryCategoryField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized === 'ebay offer secondary category id'
    || normalized === 'ebay_offer_secondary_category_id'
    || normalized === 'ebay_offer_secondarycategoryid'
    || normalized === 'secondary category id'
    || normalized === 'secondary_category_id'
    || normalized === 'secondary category'
    || normalized === 'secondary_category'
    || normalized === 'secondary category airtable'
    || normalized === 'secondary_category_airtable';
}

function isEbayPrimaryCategoryNameField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized === 'primary category name'
    || normalized === 'primary_category_name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay_offer_primary_category_name'
    || normalized === 'ebay_offer_primarycategoryname';
}

function isEbaySecondaryCategoryNameField(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized === 'secondary category name'
    || normalized === 'secondary_category_name'
    || normalized === 'ebay offer secondary category name'
    || normalized === 'ebay_offer_secondary_category_name'
    || normalized === 'ebay_offer_secondarycategoryname';
}

export function resolveSelectedCategoryIds(fields: ApprovalFieldMap): string[] {
  const entries = Object.entries(fields);
  const categories = entries.filter(([fieldName]) => isEbayCategoriesField(fieldName)).flatMap(([, value]) => parseCategoryIds(value));
  const primary = entries.find(([fieldName]) => isEbayPrimaryCategoryField(fieldName));
  const secondary = entries.find(([fieldName]) => isEbaySecondaryCategoryField(fieldName));
  const values = [
    ...categories,
    ...(primary ? [normalizeCategoryToken(String(primary[1] ?? ''))] : []),
    ...(secondary ? [normalizeCategoryToken(String(secondary[1] ?? ''))] : []),
  ].filter(Boolean);
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function resolveSelectedCategoryNames(fields: ApprovalFieldMap): string[] {
  const entries = Object.entries(fields);
  const categories = entries.filter(([fieldName]) => isEbayCategoriesField(fieldName)).flatMap(([, value]) => parseCategoryNames(value));
  const primary = entries.find(([fieldName]) => isEbayPrimaryCategoryNameField(fieldName));
  const secondary = entries.find(([fieldName]) => isEbaySecondaryCategoryNameField(fieldName));
  const values = [
    ...categories,
    ...(primary ? [normalizeCategoryToken(String(primary[1] ?? ''))] : []),
    ...(secondary ? [normalizeCategoryToken(String(secondary[1] ?? ''))] : []),
  ].filter((value) => value.length > 0 && !looksLikeCategoryIdToken(value));
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 2);
}

export function buildCategoryFieldUpdates(fields: ApprovalFieldMap, selectedCategoryNames: string[]): Record<string, string> {
  const updates: Record<string, string> = {};
  const primaryNameField = Object.keys(fields).find((fieldName) => isEbayPrimaryCategoryNameField(fieldName));
  const secondaryNameField = Object.keys(fields).find((fieldName) => isEbaySecondaryCategoryNameField(fieldName));
  const nextPrimaryCategoryName = selectedCategoryNames[0] ?? '';
  const nextSecondaryCategoryName = selectedCategoryNames[1] ?? '';

  if (primaryNameField && nextPrimaryCategoryName && String(fields[primaryNameField] ?? '').trim() !== nextPrimaryCategoryName) {
    updates[primaryNameField] = nextPrimaryCategoryName;
  }
  if (secondaryNameField && nextSecondaryCategoryName && String(fields[secondaryNameField] ?? '').trim() !== nextSecondaryCategoryName) {
    updates[secondaryNameField] = nextSecondaryCategoryName;
  }

  return updates;
}