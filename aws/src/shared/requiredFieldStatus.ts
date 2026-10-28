function normalizeFieldName(fieldName: string): string {
  return fieldName.trim().toLowerCase();
}

function isTitleLikeFieldName(fieldName: string): boolean {
  return normalizeFieldName(fieldName).includes('title');
}

function isPriceLikeFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized.includes('price')
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now / starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

function isShopifyCategoryLikeFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName);
  return normalized === 'type'
    || normalized === 'shopify type'
    || normalized === 'product type'
    || normalized === 'shopify product type'
    || normalized === 'shopify rest product type'
    || normalized === 'shopify category'
    || normalized === 'shopify product category'
    || normalized === 'shopify rest product category'
    || normalized === 'category'
    || normalized === 'product category'
    || normalized === 'google product category';
}

function isEbayConditionFieldName(fieldName: string): boolean {
  return [
    '__condition__',
    'condition',
    'item condition',
    'ebay inventory condition',
  ].includes(normalizeFieldName(fieldName));
}

function isEbayFormatFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName).replace(/[_\s]+/g, ' ');
  return normalized === 'ebay listing format'
    || normalized === 'ebay offer format'
    || normalized === 'listing format';
}

function isEbayCategoryFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldName(fieldName).replace(/[_\s]+/g, ' ');
  if (normalized.includes('shopify') || normalized.includes('google') || normalized.includes('taxonomy') || normalized.includes('product type')) {
    return false;
  }

  if (normalized === 'categories') return true;
  if (!normalized.includes('categor') || normalized.includes('name')) return false;

  return normalized.includes('ebay')
    || normalized.includes('id')
    || normalized.includes('primary')
    || normalized.includes('secondary')
    || normalized.includes('airtable')
    || normalized.includes('linked')
    || normalized.includes('json');
}

function matchesRequiredFieldGroup(fieldName: string, requiredFieldName: string): boolean {
  const normalizedField = normalizeFieldName(fieldName);
  const normalizedRequired = normalizeFieldName(requiredFieldName);

  if (normalizedField === normalizedRequired) return true;
  if (isTitleLikeFieldName(fieldName) && isTitleLikeFieldName(requiredFieldName)) return true;
  if (isPriceLikeFieldName(fieldName) && isPriceLikeFieldName(requiredFieldName)) return true;
  if (isShopifyCategoryLikeFieldName(fieldName) && isShopifyCategoryLikeFieldName(requiredFieldName)) return true;
  if (isEbayConditionFieldName(fieldName) && isEbayConditionFieldName(requiredFieldName)) return true;
  if (isEbayFormatFieldName(fieldName) && isEbayFormatFieldName(requiredFieldName)) return true;
  if (isEbayCategoryFieldName(fieldName) && isEbayCategoryFieldName(requiredFieldName)) return true;

  return false;
}

function resolveRequiredFieldValue(source: Record<string, unknown>, requiredFieldName: string): unknown {
  const exactValue = source[requiredFieldName];
  if (exactValue !== undefined && exactValue !== null && String(exactValue).trim() !== '') {
    return exactValue;
  }

  const aliasEntry = Object.entries(source).find(([fieldName, rawValue]) => {
    if (!matchesRequiredFieldGroup(fieldName, requiredFieldName)) return false;
    if (rawValue === null || rawValue === undefined) return false;
    return String(rawValue).trim() !== '';
  });

  if (aliasEntry) return aliasEntry[1];
  if (isEbayConditionFieldName(requiredFieldName)) return 'Used';
  return exactValue;
}

export function isMissingRequiredFieldValue(fieldName: string, rawValue: unknown): boolean {
  if (rawValue === null || rawValue === undefined) return true;

  const stringValue = String(rawValue).trim();
  if (!stringValue) return true;

  if (isPriceLikeFieldName(fieldName)) {
    const numericValue = Number(stringValue);
    return !Number.isFinite(numericValue) || numericValue <= 0;
  }

  return false;
}

export function getMissingRequiredFieldNames(source: Record<string, unknown>, requiredFieldNames: string[]): string[] {
  return requiredFieldNames.filter((fieldName) => isMissingRequiredFieldValue(fieldName, resolveRequiredFieldValue(source, fieldName)));
}

export function isReadyForRequiredFields(source: Record<string, unknown>, requiredFieldNames: string[]): boolean {
  if (requiredFieldNames.length === 0) return true;
  return getMissingRequiredFieldNames(source, requiredFieldNames).length === 0;
}