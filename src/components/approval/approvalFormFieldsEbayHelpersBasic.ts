import { isShippingServiceField } from '@/stores/approvalStore';

export type EbayListingTemplateId = 'classic' | 'impact-slate' | 'impact-luxe';

export const DEFAULT_EBAY_LISTING_TEMPLATE_ID: EbayListingTemplateId = 'classic';

export function normalizeEbayListingTemplateId(value: string): EbayListingTemplateId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return DEFAULT_EBAY_LISTING_TEMPLATE_ID;

  if (normalized === 'classic' || normalized.includes('insert') || normalized.includes('legacy') || normalized.includes('heritage')) {
    return 'classic';
  }

  if (normalized === 'impact-slate' || normalized === 'slate' || normalized.includes('impact slate')) {
    return 'impact-slate';
  }

  if (normalized === 'impact-luxe' || normalized === 'luxe' || normalized.includes('impact luxe')) {
    return 'impact-luxe';
  }

  return DEFAULT_EBAY_LISTING_TEMPLATE_ID;
}

export function normalizeEbayListingFormat(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

export function normalizeEbayListingDuration(value: string): string {
  const trimmed = value.trim().toUpperCase();
  if (trimmed === 'GOOD TILL CANCEL' || trimmed === 'GTC') return 'GTC';
  if (trimmed === '7 DAYS' || trimmed === 'DAYS_7') return 'DAYS_7';
  if (trimmed === '10 DAYS' || trimmed === 'DAYS_10') return 'DAYS_10';
  return value.trim();
}

export function getEbayPriceFieldLabel(listingFormat: string): string {
  const normalized = normalizeEbayListingFormat(listingFormat);
  if (normalized === 'AUCTION') return 'Starting Auction Price';
  if (normalized === 'FIXED_PRICE' || normalized === 'BUY_IT_NOW') return 'Buy It Now Price';
  return 'Buy It Now/Starting Bid Price';
}

export function isCurrencyLikeField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const isShopifyPriceField = normalized.includes('shopify')
    && normalized.includes('price')
    && !normalized.includes('currency');
  const isGenericPriceField = normalized === 'price' || /^variant\s+\d+\s+price$/.test(normalized);
  const isShippingFlatFeeField = normalized.includes('shipping')
    && normalized.includes('flat')
    && (normalized.includes('fee') || normalized.includes('cost') || normalized.includes('rate'));

  return normalized === 'ebay offer price value'
    || normalized === 'ebay price'
    || normalized === 'buy it now usd'
    || normalized === 'starting bid usd'
    || normalized === 'buy it now/starting bid'
    || normalized === 'buy it now/starting price'
    || normalized === 'buy it now / starting price'
    || normalized.includes('handling cost')
    || isShippingFlatFeeField
    || isShopifyPriceField
    || isGenericPriceField;
}

export function isEbayHandlingCostField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized.includes('handling cost') || compact.includes('handlingcost');
}

export function isEbayGlobalShippingField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[^a-z0-9]/g, '');

  return (normalized.includes('global') && normalized.includes('shipping'))
    || compact.includes('globalshipping')
    || compact.includes('globalshippingprogram');
}

export function isEbayBodyDescriptionField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'description'
    || normalized === 'item description'
    || normalized === 'ebay inventory product description'
    || normalized === 'ebay_inventory_product_description';
}

export function isGenericSharedKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json';
}

export function isEbayKeyFeaturesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'ebay body key features'
    || normalized === 'ebay body key features json'
    || normalized === 'ebay listing key features'
    || normalized === 'ebay listing key features json'
    || normalized === 'key features'
    || normalized === 'key features json'
    || normalized === 'features'
    || normalized === 'features json'
    || normalized === 'ebay_body_key_features'
    || normalized === 'ebay_body_key_features_json'
    || normalized === 'ebay_listing_key_features'
    || normalized === 'ebay_listing_key_features_json') {
    return true;
  }

  const squashed = normalized.replace(/[^a-z0-9]/g, '');
  return squashed.includes('ebaykeyfeature')
    || squashed.includes('keyfeature')
    || squashed.includes('keyvaluepair')
    || squashed.includes('featurevaluepair')
    || squashed.includes('featurepairs')
    || squashed.includes('keypairs');
}

export function isEbayTestingNotesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'testing notes'
    || normalized === 'testing notes json'
    || normalized === 'ebay testing notes'
    || normalized === 'ebay testing notes json'
    || normalized === 'ebay body testing notes'
    || normalized === 'ebay body testing notes json'
    || normalized === 'ebay listing testing notes'
    || normalized === 'ebay listing testing notes json'
    || normalized === 'testing_notes'
    || normalized === 'testing_notes_json'
    || normalized === 'ebay_testing_notes'
    || normalized === 'ebay_testing_notes_json'
    || normalized === 'ebay_body_testing_notes'
    || normalized === 'ebay_body_testing_notes_json'
    || normalized === 'ebay_listing_testing_notes'
    || normalized === 'ebay_listing_testing_notes_json'
    || compact === 'testingnotes'
    || compact === 'testingnotesjson'
    || compact === 'ebaytestingnotes'
    || compact === 'ebaytestingnotesjson'
    || compact === 'ebaybodytestingnotes'
    || compact === 'ebaybodytestingnotesjson'
    || compact === 'ebaylistingtestingnotes'
    || compact === 'ebaylistingtestingnotesjson';
}

export function isEbayAttributesField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  return normalized === 'ebay inventory product aspects json'
    || normalized === 'ebay inventory product aspects'
    || normalized === 'ebay inventory aspects'
    || normalized === 'ebay product aspects'
    || normalized === 'ebay aspects'
    || normalized === 'ebay_inventory_product_aspects_json'
    || normalized === 'ebay_inventory_product_aspects'
    || normalized === 'ebay_inventory_aspects'
    || compact === 'ebayinventoryproductaspectsjson'
    || compact === 'ebayinventoryproductaspects'
    || compact === 'ebayinventoryaspects'
    || compact === 'ebayproductaspects'
    || compact === 'ebayaspects';
}

export function isEbayBodyHtmlField(fieldName: string): boolean {
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

export function isEbayBodyHtmlTemplateField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'ebay body html template'
    || normalized === 'ebay listing template'
    || normalized === 'ebay template'
    || normalized === 'body html template'
    || normalized === 'listing template'
    || normalized === 'ebay_body_html_template'
    || normalized === 'ebay_listing_template';
}

export function isEbayShippingServiceFieldName(fieldName: string, getCanonicalShippingServiceAlias: (fieldName: string) => string | null): boolean {
  return isShippingServiceField(fieldName) || getCanonicalShippingServiceAlias(fieldName) !== null;
}