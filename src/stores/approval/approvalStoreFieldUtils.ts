import {
  CURRENCY_CODE_OPTIONS,
  EBAY_DIMENSION_UNIT_OPTIONS,
  EBAY_FORMAT_OPTIONS,
  EBAY_LISTING_DURATION_OPTIONS,
  EBAY_MARKETPLACE_ID_OPTIONS,
  EBAY_RESPONSIBLE_PERSON_TYPE_OPTIONS,
  EBAY_WEIGHT_UNIT_OPTIONS,
  FALLBACK_LISTING_FORMAT_OPTIONS,
  ITEM_CONDITION_OPTIONS,
  SHIPPING_SERVICE_FIELD,
  SHOPIFY_COMBINED_LISTING_ROLE_OPTIONS,
  SHOPIFY_FULFILLMENT_SERVICE_OPTIONS,
  SHOPIFY_GRAPHQL_STATUS_OPTIONS,
  SHOPIFY_INVENTORY_MANAGEMENT_OPTIONS,
  SHOPIFY_INVENTORY_POLICY_OPTIONS,
  SHOPIFY_MEDIA_CONTENT_TYPE_OPTIONS,
  SHOPIFY_METAFIELD_TYPE_OPTIONS,
  SHOPIFY_PUBLISHED_SCOPE_OPTIONS,
  SHOPIFY_REST_STATUS_OPTIONS,
  SHOPIFY_WEIGHT_UNIT_OPTIONS,
} from '@/stores/approval/approvalStoreConstants';

export type ApprovalFieldKind = 'boolean' | 'number' | 'json' | 'text';

function normalizeBooleanLikeString(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return 'TRUE';
  if (normalized === 'false') return 'FALSE';
  return raw;
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function inferFieldKind(value: unknown): ApprovalFieldKind {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (Array.isArray(value)) return 'json';
  if (value && typeof value === 'object') return 'json';
  return 'text';
}

export function toFormValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function fromFormValue(raw: string, kind: ApprovalFieldKind): unknown {
  if (raw === '') return null;

  if (kind === 'boolean') {
    const normalized = raw.trim().toLowerCase();
    return normalized === 'true';
  }

  if (kind === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (kind === 'json') {
    try {
      return JSON.parse(raw);
    } catch {
      return normalizeBooleanLikeString(raw);
    }
  }

  return normalizeBooleanLikeString(raw);
}

export function getDropdownOptions(fieldName: string): string[] | null {
  const n = fieldName.trim().toLowerCase();

  // Legacy humanized field names (old Airtable schema)
  if (
    n === '__condition__'
    || n === 'item condition'
    || n === 'condition'
    || n === 'shopify condition'
    || n === 'shopify rest condition'
    || n === 'ebay inventory condition'
  ) {
    return ITEM_CONDITION_OPTIONS;
  }

  // Shopify: product status
  if (n === 'shopify rest status' || n === 'shopify status') return SHOPIFY_REST_STATUS_OPTIONS;
  if (n === 'shopify graphql status') return SHOPIFY_GRAPHQL_STATUS_OPTIONS;

  // Shopify: published scope
  if (n === 'shopify rest published scope') return SHOPIFY_PUBLISHED_SCOPE_OPTIONS;

  // Shopify: variant fields (pattern: "shopify rest variant N <field>")
  if (n.startsWith('shopify rest variant') && n.endsWith('inventory management')) return SHOPIFY_INVENTORY_MANAGEMENT_OPTIONS;
  if (n.startsWith('shopify rest variant') && n.endsWith('inventory policy')) return SHOPIFY_INVENTORY_POLICY_OPTIONS;
  if (n.startsWith('shopify rest variant') && n.endsWith('weight unit')) return SHOPIFY_WEIGHT_UNIT_OPTIONS;
  if (n.startsWith('shopify rest variant') && n.endsWith('fulfillment service')) return SHOPIFY_FULFILLMENT_SERVICE_OPTIONS;

  // Shopify: metafield type (both REST and GraphQL)
  if (n.includes('metafield') && n.endsWith('type')) return SHOPIFY_METAFIELD_TYPE_OPTIONS;

  // Shopify: combined listing role
  if (n === 'shopify graphql combined listing role') return SHOPIFY_COMBINED_LISTING_ROLE_OPTIONS;

  // Shopify: media content type
  if (n.includes('shopify') && n.includes('media') && n.endsWith('content type')) return SHOPIFY_MEDIA_CONTENT_TYPE_OPTIONS;

  // eBay: inventory condition options are normalized to ITEM_CONDITION_OPTIONS above.

  // eBay: package units
  if (n === 'ebay inventory package dimension unit') return EBAY_DIMENSION_UNIT_OPTIONS;
  if (n === 'ebay inventory package weight unit') return EBAY_WEIGHT_UNIT_OPTIONS;

  // eBay: offer fields
  if (n === 'ebay offer format') return EBAY_FORMAT_OPTIONS;
  if (n === 'ebay offer marketplace id') return EBAY_MARKETPLACE_ID_OPTIONS;
  if (
    n === 'ebay offer listing duration'
    || n === 'ebay listing duration'
    || n === 'listing duration'
    || n === 'duration'
    || n === 'ebay_offer_listingduration'
    || n === 'ebay_offer_listing_duration'
  ) return EBAY_LISTING_DURATION_OPTIONS;
  if (n.includes('ebay offer') && n.includes('currency')) return CURRENCY_CODE_OPTIONS;

  // Shopify: currency fields
  if (n.includes('shopify') && n.includes('currency')) return CURRENCY_CODE_OPTIONS;

  // eBay: responsible person type
  if (n.includes('ebay offer responsible person') && n.endsWith('type')) return EBAY_RESPONSIBLE_PERSON_TYPE_OPTIONS;

  return null;
}

export function isAllowOffersField(fieldName: string): boolean {
  return fieldName.trim().toLowerCase() === 'allow offers';
}

export function isShippingServiceField(fieldName: string): boolean {
  const normalized = fieldName.trim().toLowerCase();
  return normalized === 'domestic service 1'
    || normalized === 'domestic service 2'
    || normalized === 'international service 1'
    || normalized === 'international service 2';
}

function normalizeListingFormat(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized === 'FIXED_PRICE') return 'Buy It Now';
  if (normalized === 'AUCTION') return 'Auction';
  return raw.trim();
}

export function resolveListingFormatOptions(formats: string[]): string[] {
  return Array.from(new Set([...FALLBACK_LISTING_FORMAT_OPTIONS, ...formats.map(normalizeListingFormat)]))
    .filter((format) => format.length > 0);
}

export function mapShippingServiceToFields(values: Record<string, string>): Record<string, string> {
  const selected = values[SHIPPING_SERVICE_FIELD] ?? '';
  return {
    ...values,
    'Domestic Service 1': selected === 'UPS Ground' || selected === 'UPS 3-Day Select' ? selected : '',
    'Domestic Service 2': '',
    'International Service 1':
      selected === 'International'
      || selected === 'USPS Priority Mail International'
      || selected === 'eBay International Standard Delivery'
        ? selected
        : '',
    'International Service 2': '',
  };
}