import { CONDITION_FIELD } from '@/stores/approvalStore';

export function toHumanReadableLabel(fieldName: string): string {
  const normalizedFieldName = fieldName.trim().toLowerCase();
  if (fieldName === CONDITION_FIELD) return 'Condition';
  if (normalizedFieldName === 'ebay offer price value') return 'eBay Price';
  if (normalizedFieldName === 'ebay price') return 'eBay Price';
  if (normalizedFieldName === 'buy it now usd') return 'eBay Price';
  if (normalizedFieldName === 'starting bid usd') return 'eBay Price';
  if (normalizedFieldName === 'shopify rest variant 1 price') return 'Shopify Price';
  if (normalizedFieldName === 'shopify price') return 'Shopify Price';
  if (normalizedFieldName === 'type') return 'Shopify Type';
  if (normalizedFieldName === 'shipping weight') return 'Shipping Weight (in lbs)';
  if (normalizedFieldName === 'shipping dims') return 'Shipping Dimensions (L"W"H" in inches)';
  if (normalizedFieldName === 'ebay domestic service 1') return 'Ebay Domestic Service';
  if (normalizedFieldName === 'ebay international service 1') return 'Ebay International Service';

  const withSpaces = fieldName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withSpaces) return fieldName;

  return withSpaces
    .split(' ')
    .map((word) => {
      if (!word) return word;
      if (/^[A-Z0-9]+$/.test(word)) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function isReadOnlyApprovalField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify rest product id' || normalized === 'shopify product id';
}

export function isBooleanLikeValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'false';
}

export function isScalarImageField(fieldName: string, isImageUrlListField: (fieldName: string) => boolean): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (!normalized.includes('image')) return false;
  if (isImageUrlListField(fieldName)) return false;
  return /(url|src|position|alt|alt\s+text|alt_text)/.test(normalized);
}

export function isConditionMirrorSourceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'item condition'
    || normalized === 'shopify condition'
    || normalized === 'shopify rest condition'
    || normalized === 'ebay inventory condition';
}

export function isTitleLikeField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase().includes('title');
}

export function isPriceLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

export function isEbayPriceFieldAlias(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'price'
    || normalized === 'ebay offer price value'
    || normalized === 'ebay offer auction start price value'
    || normalized === 'ebay price'
    || normalized === 'ebay buy it now/starting bid'
    || normalized === 'ebay buy it now / starting bid'
    || normalized === 'ebay buy it now/starting price'
    || normalized === 'ebay buy it now / starting price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized.includes('buy it now')
    || normalized.includes('starting bid')
    || normalized.includes('starting price');
}

export function isFormatLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'listing format'
    || normalized === 'ebay offer format'
    || normalized === 'status';
}

export function prioritizeTitleBeforePrice(fieldNames: string[], approvalChannel?: 'shopify' | 'ebay' | 'combined'): string[] {
  return [...fieldNames].sort((left, right) => {
    const getPriority = (fieldName: string): number => {
      if (isTitleLikeField(fieldName)) return 0;
      if (isPriceLikeField(fieldName)) return 1;
      if (approvalChannel === 'ebay' && isFormatLikeField(fieldName)) return 2;
      return 3;
    };

    return getPriority(left) - getPriority(right);
  });
}