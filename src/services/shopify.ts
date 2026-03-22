import axios, { AxiosInstance } from 'axios';
import { requireEnv, requireOneOfEnv } from '@/config/runtimeEnv';
import { logServiceError } from '@/services/logger';
import {
  ShopifyProduct,
  ShopifyProductResponse,
  ShopifyProductsResponse,
  ShopifyProductVariant,
} from '@/types/shopify';

const READ_ONLY_CREATE_KEYS = new Set([
  'id',
  'product_id',
  'admin_graphql_api_id',
  'inventory_item_id',
  'old_inventory_quantity',
]);

function normalizeBooleanLikeString(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return 'TRUE';
  if (normalized === 'false') return 'FALSE';
  return value;
}

function sanitizeForShopifyCreate(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForShopifyCreate(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !READ_ONLY_CREATE_KEYS.has(key))
      .map(([key, child]) => [key, sanitizeForShopifyCreate(child)] as const)
      .filter(([, child]) => child !== undefined);

    return Object.fromEntries(entries);
  }

  if (typeof value === 'string') {
    return normalizeBooleanLikeString(value);
  }

  return value;
}

export function prepareShopifyCreateProductRequest(product: ShopifyProduct): { product: ShopifyProduct } {
  const sanitized = sanitizeForShopifyCreate(product) as ShopifyProduct;
  return { product: sanitized };
}

export type ShopifyCreateProductRequest = ReturnType<typeof prepareShopifyCreateProductRequest>;

function ensureRequiredVariant(product: ShopifyProduct): ShopifyProduct['variants'] {
  const source = Array.isArray(product.variants) && product.variants.length > 0
    ? product.variants
    : [{} as ShopifyProductVariant];

  return source.map((variant, index) => {
    const priceRaw = typeof variant?.price === 'string' ? variant.price.trim() : '';
    const price = priceRaw.length > 0 ? priceRaw : '0.00';

    return {
      ...variant,
      price,
      inventory_management: variant?.inventory_management || (typeof variant?.inventory_quantity === 'number' ? 'shopify' : variant?.inventory_management),
      inventory_policy: variant?.inventory_policy || 'deny',
      taxable: typeof variant?.taxable === 'boolean' ? variant.taxable : true,
      requires_shipping: typeof variant?.requires_shipping === 'boolean' ? variant.requires_shipping : true,
      position: variant?.position ?? index + 1,
    };
  });
}

export function buildShopifyCreateProductRequestWithRequiredFields(product: ShopifyProduct): ShopifyCreateProductRequest {
  const requiredSafeProduct: ShopifyProduct = {
    ...product,
    title: typeof product.title === 'string' && product.title.trim().length > 0 ? product.title.trim() : 'Untitled Listing',
    status: product.status ?? 'draft',
    published_scope: typeof product.published_scope === 'string' && product.published_scope.trim().length > 0
      ? product.published_scope
      : 'web',
    template_suffix: typeof product.template_suffix === 'string' && product.template_suffix.trim().length > 0
      ? product.template_suffix
      : 'product-template',
    variants: ensureRequiredVariant(product),
  };

  return prepareShopifyCreateProductRequest(requiredSafeProduct);
}

class ShopifyService {
  private client: AxiosInstance;
  private domain: string;
  private accessToken: string;
  private isBrowser: boolean;

  constructor() {
    this.domain = requireEnv('VITE_SHOPIFY_STORE_DOMAIN');
    this.accessToken = requireOneOfEnv(['VITE_SHOPIFY_OAUTH_ACCESS_TOKEN', 'VITE_SHOPIFY_ADMIN_API_TOKEN']);

    // In the browser, route through the Vite dev proxy to avoid CORS.
    // In a Node/test context (import.meta.env is undefined), call directly.
    this.isBrowser = typeof window !== 'undefined';
    const baseURL = this.isBrowser
      ? '/shopify-proxy/admin/api/2024-04'
      : `https://${this.domain}/admin/api/2024-04`;

    this.client = axios.create({
      baseURL,
      headers: {
        ...(this.isBrowser ? {} : { 'X-Shopify-Access-Token': this.accessToken }),
        'Content-Type': 'application/json',
      },
    });

    if (import.meta.env.DEV) {
      console.info('[shopify] client configured', {
        isBrowser: this.isBrowser,
        baseURL,
        storeDomain: this.domain,
      });
    }
  }

  async getProducts(limit = 50): Promise<ShopifyProductsResponse['products']> {
    try {
      const response = await this.client.get<ShopifyProductsResponse>('/products.json', {
        params: { limit },
      });
      return response.data.products;
    } catch (err: unknown) {
      if (import.meta.env.DEV && axios.isAxiosError(err)) {
        const request = err.request as { responseURL?: string } | undefined;
        console.error('[shopify] getProducts failed', {
          baseURL: this.client.defaults.baseURL,
          storeDomain: this.domain,
          responseURL: request?.responseURL,
          status: err.response?.status,
          data: err.response?.data,
        });
      }
      throw err;
    }
  }

  async getProduct(id: number): Promise<(ShopifyProductResponse['product']) | null> {
    try {
      const response = await this.client.get<ShopifyProductResponse>(`/products/${id}.json`);
      return response.data.product;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async createProduct(product: ShopifyProduct): Promise<ShopifyProductResponse['product']> {
    const payload = prepareShopifyCreateProductRequest(product);
    const response = await this.client.post<ShopifyProductResponse>('/products.json', payload);
    return response.data.product;
  }

  async createProductFromRequest(payload: ShopifyCreateProductRequest): Promise<ShopifyProductResponse['product']> {
    const response = await this.client.post<ShopifyProductResponse>('/products.json', payload);
    return response.data.product;
  }

  async updateProduct(
    id: number,
    updates: Partial<ShopifyProduct>
  ): Promise<ShopifyProductResponse['product']> {
    const response = await this.client.put<ShopifyProductResponse>(`/products/${id}.json`, {
      product: { id, ...updates },
    });
    return response.data.product;
  }

  async deleteProduct(id: number): Promise<void> {
    await this.client.delete(`/products/${id}.json`);
  }

  async testConnection(): Promise<{ success: boolean; shopName?: string; error?: string }> {
    try {
      const response = await this.client.get('/shop.json');
      return { success: true, shopName: response.data.shop.name };
    } catch (err: unknown) {
      logServiceError('shopify', 'Connection test failed', err);
      const message =
        axios.isAxiosError(err)
          ? err.response?.data?.errors ?? err.message
          : String(err);
      return { success: false, error: String(message) };
    }
  }
}

export const shopifyService = new ShopifyService();
