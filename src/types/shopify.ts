export interface ShopifyProductImage {
  src: string;
  alt?: string;
}

export interface ShopifyProductVariant {
  price: string;
  sku?: string;
  inventory_quantity?: number;
  inventory_management?: string;
}

export interface ShopifyProduct {
  id?: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string;
  status?: 'active' | 'draft' | 'archived';
  variants?: ShopifyProductVariant[];
  images?: ShopifyProductImage[];
}

export interface ShopifyProductResponse {
  product: ShopifyProduct & { id: number; created_at: string; updated_at: string };
}

export interface ShopifyProductsResponse {
  products: Array<ShopifyProduct & { id: number; created_at: string; updated_at: string }>;
}
