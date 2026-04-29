export type ApprovalFieldMap = Record<string, unknown>;

export interface ShopifyProductImage {
  id?: number;
  src: string;
  alt?: string;
  position?: number;
  variant_ids?: number[];
}

export interface ShopifyProductOption {
  id?: number;
  name: string;
  position?: number;
  values: string[];
}

export interface ShopifyProductVariant {
  id?: number;
  title?: string;
  position?: number;
  price?: string;
  compare_at_price?: string | null;
  sku?: string;
  barcode?: string;
  inventory_quantity?: number;
  inventory_management?: string;
  inventory_policy?: string;
  fulfillment_service?: string;
  taxable?: boolean;
  requires_shipping?: boolean;
  weight?: number;
  weight_unit?: string;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
}

export interface ShopifyMetafield {
  id?: number;
  namespace: string;
  key: string;
  type: string;
  value: string;
}

export interface ShopifyProduct {
  id?: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle?: string;
  published_at?: string | null;
  published_scope?: string;
  template_suffix?: string | null;
  tags?: string;
  status?: 'active' | 'draft' | 'archived';
  options?: ShopifyProductOption[];
  variants?: ShopifyProductVariant[];
  images?: ShopifyProductImage[];
  metafields?: ShopifyMetafield[];
}

export const SHOPIFY_DEFAULT_VENDOR = 'Resolution Audio Video NYC';
export const CONDITION_LABELS = ['Used', 'New', 'Open Box', 'For Parts or not working'] as const;
export const SHOPIFY_BODY_HTML_TEMPLATE_FIELD_CANDIDATES = [
  'Shopify REST Body HTML Template',
  'Shopify Body HTML Template',
  'shopify_rest_body_html_template',
  'shopify_body_html_template',
] as const;
export const SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES = [
  'Type',
  'Product Type',
  'Shopify REST Product Type',
  'Shopify Product Type',
  'Shopify GraphQL Product Type',
  'Shopify REST Category',
  'Shopify Category',
  'Shopify Product Category',
  'Shopify REST Product Category',
  'Google Product Category',
  'Product Category',
  'Category',
  'shopify_rest_product_type',
  'shopify_product_type',
  'shopify_product_category',
  'shopify_rest_product_category',
  'google_product_category',
  'product_category',
] as const;

export interface ShopifyBodyDynamicTokenSpec {
  token: string;
  candidates: string[];
  formatter?: (value: string) => string;
}