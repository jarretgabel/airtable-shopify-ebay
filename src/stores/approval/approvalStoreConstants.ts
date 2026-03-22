export const DEFAULT_APPROVAL_TABLE_REFERENCE = '3yTb0JkzUMFNnS/viw21kEduXKNub4Vn';
export const SHIPPING_SERVICE_FIELD = '__Shipping Services__';
export const CONDITION_FIELD = '__Condition__';

// Legacy humanized options (old Airtable schema)
export const ITEM_CONDITION_OPTIONS = ['Used', 'New', 'Open Box', 'For Parts or not working'];
export const SHIPPING_SERVICE_OPTIONS = [
  'UPS Ground',
  'UPS 3-Day Select',
  'International',
  'USPS Priority Mail International',
  'eBay International Standard Delivery',
];
export const FALLBACK_LISTING_FORMAT_OPTIONS = ['Buy It Now', 'Auction'];

// Shopify field options
export const SHOPIFY_REST_STATUS_OPTIONS = ['draft', 'active', 'archived'];
export const SHOPIFY_GRAPHQL_STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
export const SHOPIFY_INVENTORY_MANAGEMENT_OPTIONS = ['shopify'];
export const SHOPIFY_INVENTORY_POLICY_OPTIONS = ['deny', 'continue'];
export const SHOPIFY_WEIGHT_UNIT_OPTIONS = ['lb', 'oz', 'kg', 'g'];
export const SHOPIFY_FULFILLMENT_SERVICE_OPTIONS = ['manual'];
export const SHOPIFY_METAFIELD_TYPE_OPTIONS = [
  'single_line_text_field',
  'multi_line_text_field',
  'boolean',
  'number_integer',
  'number_decimal',
  'url',
];
export const SHOPIFY_COMBINED_LISTING_ROLE_OPTIONS = ['PARENT', 'CHILD'];
export const SHOPIFY_MEDIA_CONTENT_TYPE_OPTIONS = ['IMAGE', 'VIDEO', 'EXTERNAL_VIDEO', 'MODEL_3D'];
export const SHOPIFY_PUBLISHED_SCOPE_OPTIONS = ['web'];

// eBay field options
export const EBAY_CONDITION_OPTIONS = [
  'NEW',
  'LIKE_NEW',
  'NEW_OTHER',
  'USED_EXCELLENT',
  'USED_VERY_GOOD',
  'USED_GOOD',
  'CERTIFIED_REFURBISHED',
  'SELLER_REFURBISHED',
  'FOR_PARTS_OR_NOT_WORKING',
];
export const EBAY_DIMENSION_UNIT_OPTIONS = ['INCH', 'FOOT', 'CENTIMETER', 'METER'];
export const EBAY_WEIGHT_UNIT_OPTIONS = ['POUND', 'OUNCE', 'KILOGRAM', 'GRAM'];
export const EBAY_MARKETPLACE_ID_OPTIONS = [
  'EBAY_US', 'EBAY_GB', 'EBAY_DE', 'EBAY_AU', 'EBAY_CA', 'EBAY_IT', 'EBAY_FR', 'EBAY_ES',
];
export const EBAY_FORMAT_OPTIONS = ['FIXED_PRICE', 'AUCTION'];
export const EBAY_LISTING_DURATION_OPTIONS = ['GTC', 'DAYS_7', 'DAYS_10'];
export const EBAY_RESPONSIBLE_PERSON_TYPE_OPTIONS = ['MANUFACTURER', 'IMPORTER', 'EU_RESPONSIBLE_PERSON'];