import axios, { AxiosInstance } from 'axios';
import {
  ShopifyProduct,
  ShopifyProductResponse,
  ShopifyProductsResponse,
} from '@/types/shopify';

class ShopifyService {
  private client: AxiosInstance;
  private domain: string;
  private accessToken: string;

  constructor() {
    this.domain = import.meta.env.VITE_SHOPIFY_STORE_DOMAIN;
    
    // Support both token-based auth and OAuth
    const token = import.meta.env.VITE_SHOPIFY_ADMIN_API_TOKEN;
    const oauthToken = import.meta.env.VITE_SHOPIFY_OAUTH_ACCESS_TOKEN;

    this.accessToken = oauthToken || token;

    if (!this.domain || !this.accessToken) {
      throw new Error('Shopify store domain and access token (or OAuth token) must be set in environment variables');
    }

    // In the browser, route through the Vite dev proxy to avoid CORS.
    // In a Node/test context (import.meta.env is undefined), call directly.
    const isBrowser = typeof window !== 'undefined';
    const baseURL = isBrowser
      ? '/shopify-proxy/admin/api/2024-04'
      : `https://${this.domain}/admin/api/2024-04`;

    this.client = axios.create({
      baseURL,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async getProducts(limit = 50): Promise<ShopifyProductsResponse['products']> {
    const response = await this.client.get<ShopifyProductsResponse>('/products.json', {
      params: { limit },
    });
    return response.data.products;
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
      const message =
        axios.isAxiosError(err)
          ? err.response?.data?.errors ?? err.message
          : String(err);
      return { success: false, error: String(message) };
    }
  }
}

export const shopifyService = new ShopifyService();
