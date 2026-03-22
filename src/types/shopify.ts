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
  price: string;
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

export interface ShopifyProductResponse {
  product: ShopifyProduct & { id: number; created_at: string; updated_at: string };
}

export interface ShopifyProductsResponse {
  products: Array<ShopifyProduct & { id: number; created_at: string; updated_at: string }>;
}
