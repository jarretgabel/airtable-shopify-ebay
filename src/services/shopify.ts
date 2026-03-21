import axios, { AxiosInstance } from 'axios';
import { requireEnv, requireOneOfEnv } from '@/config/runtimeEnv';
import { logServiceError } from '@/services/logger';
import {
  ShopifyProduct,
  ShopifyProductResponse,
  ShopifyProductsResponse,
} from '@/types/shopify';

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

  async createProduct(product: ShopifyProduct): Promise<ShopifyProductResponse['product']> {
    const response = await this.client.post<ShopifyProductResponse>('/products.json', {
      product,
    });
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
