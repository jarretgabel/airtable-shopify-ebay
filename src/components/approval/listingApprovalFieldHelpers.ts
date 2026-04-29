import { SHIPPING_SERVICE_FIELD } from '@/stores/approvalStore';
import {
  EBAY_BODY_HTML_FIELD_CANDIDATES,
  EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES,
  EBAY_DESCRIPTION_FIELD_CANDIDATES,
  EBAY_PRICE_FIELD_CANDIDATES,
  EBAY_TESTING_NOTES_FIELD_CANDIDATES,
  EBAY_TITLE_FIELD_CANDIDATES,
  EBAY_VENDOR_FIELD_CANDIDATES,
} from './listingApprovalEbayConstants';

export function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

export function toApprovalFieldLabel(fieldName: string, options?: { ebayListingFormat?: string }): string {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'ebay offer price value') {
    return getEbayPriceFieldLabel(options?.ebayListingFormat ?? '');
  }

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

export function normalizeFieldLookupKey(fieldName: string): string {
  return fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isTitleLikeFieldName(fieldName: string): boolean {
  return fieldName.trim().toLowerCase().includes('title');
}

export function isPriceLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('price')
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price';
}

export function isShopifyCategoryLikeFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'type'
    || normalized === 'shopify type'
    || normalized === 'product type'
    || normalized === 'shopify product type'
    || normalized === 'shopify rest product type'
    || normalized === 'shopify category'
    || normalized === 'shopify product category'
    || normalized === 'shopify rest product category'
    || normalized === 'category'
    || normalized === 'product category';
}

export function findEbayPriceFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_PRICE_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'ebayofferpricevalue'
      || normalized === 'ebayofferauctionstartpricevalue'
      || normalized.includes('buyitnowstartingbid')
      || normalized.includes('buyitnowstartingprice')
      || normalized.includes('startingbid')
      || normalized.includes('startingprice');
  });

  return fuzzy ?? '';
}

export function findEbayBodyHtmlFieldName(fieldNames: string[]): string {
  const exact = fieldNames.find((name) =>
    EBAY_BODY_HTML_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === name.toLowerCase()),
  );
  if (exact) return exact;

  const fuzzy = fieldNames.find((name) => {
    const normalized = normalizeFieldLookupKey(name);
    return normalized === 'bodyhtml'
      || normalized.includes('ebaybodyhtml')
      || normalized.includes('bodyhtml');
  });

  return fuzzy ?? '';
}

export function isEbayBodyHtmlFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'body html'
    || normalized === 'body (html)'
    || normalized === 'body_html'
    || normalized === 'ebay body html'
    || normalized === 'ebay body (html)'
    || normalized === 'ebay_body_html'
    || compact === 'ebaybodyhtml';
}

export function isEbayBodyHtmlTemplateFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

export function isEbayBodyHtmlSyncTriggerFieldName(fieldName: string): boolean {
  const normalized = normalizeFieldLookupKey(fieldName);
  if (!normalized) return false;

  const titleAndDescriptionCandidates = [
    ...EBAY_TITLE_FIELD_CANDIDATES,
    ...EBAY_DESCRIPTION_FIELD_CANDIDATES,
  ];

  if (titleAndDescriptionCandidates.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_BODY_KEY_FEATURES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  if (EBAY_TESTING_NOTES_FIELD_CANDIDATES.some((candidate) => normalizeFieldLookupKey(candidate) === normalized)) {
    return true;
  }

  return normalized.includes('keyfeature')
    || normalized.includes('featurevaluepair')
    || normalized.includes('keyvaluepair')
    || normalized.includes('featurepairs')
    || normalized.includes('keypairs')
    || normalized.includes('testingnotes');
}

export function isEbayHandlingCostFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost') || compact.includes('handlingcost');
}

export function isEbayGlobalShippingFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
}

export function isVendorFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return EBAY_VENDOR_FIELD_CANDIDATES.some((candidate) => candidate.toLowerCase() === normalized)
    || normalized === 'shopify rest vendor'
    || normalized === 'shopify vendor'
    || normalized === 'shopify graphql vendor'
    || normalized === 'shopify_rest_vendor';
}

export function isShopifyGraphqlCollectionIdsFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'shopify graphql collection ids'
    || normalized === 'shopify graphql collection id'
    || normalized === 'shopify graphql collections json'
    || normalized === 'shopify_graphql_collection_ids'
    || normalized === 'shopify_graphql_collection_id'
    || normalized === 'shopify_graphql_collections_json'
    || /^shopify\s+graphql\s+collection\s+\d+\s+id$/.test(normalized)
    || /^shopify_graphql_collection_\d+_id$/.test(normalized);
}

export function isShopifyOnlyFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  return normalized.includes('shopify')
    || normalized.includes('collection')
    || normalized.includes('published scope')
    || normalized.includes('published at')
    || normalized.includes('template suffix')
    || normalized.includes('metafield')
    || normalized === 'type'
    || normalized === 'product type';
}

export function normalizeCombinedFieldName(fieldName: string): string {
  return fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isItemZipCodeField(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'item zip code'
    || normalized === 'zip code'
    || normalized === 'postal code'
    || compact === 'itemzipcode'
    || compact === 'zipcode'
    || compact === 'itempostalcode'
    || compact === 'postalcode'
    || compact === 'locationzipcode'
    || compact === 'locationpostalcode'
    || compact === 'itempostal'
    || compact === 'locationpostal';
}

export function isEbayAttributesFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'ebay inventory product aspects json'
    || normalized === 'ebay inventory product aspects'
    || normalized === 'ebay inventory aspects'
    || normalized === 'ebay product aspects'
    || normalized === 'ebay aspects'
    || compact === 'ebayinventoryproductaspectsjson'
    || compact === 'ebayinventoryproductaspects'
    || compact === 'ebayinventoryaspects'
    || compact === 'ebayproductaspects'
    || compact === 'ebayaspects';
}

export function isEbayOnlyFieldName(fieldName: string): boolean {
  const normalized = normalizeCombinedFieldName(fieldName);
  if (normalized === 'description') return false;
  if (normalized.includes('key feature')) return false;
  if (fieldName === SHIPPING_SERVICE_FIELD) return true;
  return normalized.includes('ebay')
    || normalized.includes('buy it now')
    || normalized.includes('starting bid')
    || normalized.includes('listing duration')
    || normalized.includes('duration')
    || normalized.includes('listing format')
    || normalized.includes('format')
    || normalized === 'status'
    || normalized.includes('shipping service')
    || isItemZipCodeField(fieldName)
    || isEbayAttributesFieldName(fieldName)
    || normalized.includes('primary category')
    || normalized.includes('secondary category')
    || normalized.includes('merchant location')
    || normalized.includes('fulfillment policy')
    || normalized.includes('payment policy')
    || normalized.includes('return policy');
}

export function isRemovedCombinedEbayPriceFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'buy it now/starting bid'
    || normalized === 'buy it now / starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized === 'ebay buy it now/starting bid'
    || normalized === 'ebay buy it now / starting bid'
    || normalized === 'ebay buy it now/starting price'
    || normalized === 'ebay buy it now / starting price';
}

export function isGenericSharedKeyFeaturesFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json';
}

export function normalizeKeyFeatureLabel(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

export function shouldMoveTestingEntryToSharedKeyFeatures(feature: string): boolean {
  const normalized = normalizeKeyFeatureLabel(feature);
  return normalized === 'brand' || normalized === 'cable size';
}

export function shouldSerializeKeyFeatureFieldAsJson(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized.includes('json') || normalized.endsWith('_json');
}

export function serializeKeyFeatureEntries(
  entries: Array<{ feature: string; value: string }>,
  fieldName: string,
): string {
  const normalizedEntries = entries
    .map((entry) => ({
      feature: entry.feature.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.feature.length > 0 && entry.value.length > 0);

  if (normalizedEntries.length === 0) return '';

  if (shouldSerializeKeyFeatureFieldAsJson(fieldName)) {
    return JSON.stringify(normalizedEntries);
  }

  const escapeCsvCell = (cell: string): string => {
    if (!/[",\n\r]/.test(cell)) return cell;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  return normalizedEntries
    .map((entry) => `${escapeCsvCell(entry.feature)},${escapeCsvCell(entry.value)}`)
    .join('\n');
}

export function isHiddenCombinedFieldName(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'images (comma separated) 2'
    || compact === 'imagescommaseparated2'
    || normalized === 'shopify approved'
    || normalized === 'ebay approved'
    || compact === 'shopifyapproved'
    || compact === 'ebayapproved'
    || normalized === 'primary category name'
    || normalized === 'secondary category name'
    || normalized === 'ebay offer primary category name'
    || normalized === 'ebay offer secondary category name';
}