import axios, { AxiosInstance } from 'axios';
import { requireEnv, requireOneOfEnv } from '@/config/runtimeEnv';
import { logServiceError } from '@/services/logger';
import {
  ShopifyMetafield,
  ShopifyProduct,
  ShopifyProductResponse,
  ShopifyProductsResponse,
  ShopifyProductVariant,
} from '@/types/shopify';

interface ShopifyGraphQlError {
  message?: string;
}

interface ShopifyGraphQlResponse<TData> {
  data?: TData;
  errors?: ShopifyGraphQlError[];
}

interface ShopifyGraphQlUserError {
  field?: string[] | null;
  message: string;
}

export interface ShopifyTaxonomyCategoryMatch {
  id: string;
  fullName: string;
  name: string;
  isLeaf: boolean;
}

export interface ShopifyCollectionMatch {
  id: string;
  title: string;
  handle: string;
}

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
    const sourceRecord = value as Record<string, unknown>;
    const explicitBodyHtml = sourceRecord.body_html;
    const legacyDescription = sourceRecord.description;
    const normalizedBodyHtml = explicitBodyHtml ?? legacyDescription;

    const entries = Object.entries(sourceRecord)
      .filter(([key]) => !READ_ONLY_CREATE_KEYS.has(key) && key !== 'body_html' && key !== 'description')
      .map(([key, child]) => [key, sanitizeForShopifyCreate(child)] as const)
      .filter(([, child]) => child !== undefined);

    if (normalizedBodyHtml !== undefined) {
      entries.push(['body_html', sanitizeForShopifyCreate(normalizedBodyHtml)]);
    }

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

type ShopifyGraphQlProductStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
type ShopifyGraphQlInventoryPolicy = 'CONTINUE' | 'DENY';
type ShopifyGraphQlWeightUnit = 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS';

export interface ShopifyUnifiedProductSetIdentifier {
  id?: string;
  handle?: string;
}

export interface ShopifyUnifiedProductSetFileInput {
  originalSource: string;
  alt?: string;
  contentType: 'IMAGE';
}

export interface ShopifyUnifiedProductSetOptionValueInput {
  name: string;
}

export interface ShopifyUnifiedProductSetOptionInput {
  name: string;
  position?: number;
  values?: ShopifyUnifiedProductSetOptionValueInput[];
}

export interface ShopifyUnifiedVariantOptionValueInput {
  optionName: string;
  name: string;
}

export interface ShopifyUnifiedInventoryItemInput {
  sku?: string;
  tracked?: boolean;
  requiresShipping?: boolean;
  measurement?: {
    weight: {
      value: number;
      unit: ShopifyGraphQlWeightUnit;
    };
  };
}

export interface ShopifyUnifiedProductSetVariantInput {
  optionValues: ShopifyUnifiedVariantOptionValueInput[];
  price?: string;
  sku?: string;
  barcode?: string;
  position?: number;
  compareAtPrice?: string;
  inventoryPolicy?: ShopifyGraphQlInventoryPolicy;
  inventoryItem?: ShopifyUnifiedInventoryItemInput;
  taxable?: boolean;
}

export interface ShopifyUnifiedProductSetInput {
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  handle?: string;
  status?: ShopifyGraphQlProductStatus;
  tags?: string[];
  templateSuffix?: string;
  category?: string;
  collectionsToJoin?: string[];
  files?: ShopifyUnifiedProductSetFileInput[];
  metafields?: ShopifyMetafield[];
  productOptions?: ShopifyUnifiedProductSetOptionInput[];
  variants?: ShopifyUnifiedProductSetVariantInput[];
}

export interface ShopifyUnifiedProductSetRequest {
  input: ShopifyUnifiedProductSetInput;
  synchronous: true;
  identifier?: ShopifyUnifiedProductSetIdentifier;
}

export interface ShopifyUnifiedProductResult {
  id: number;
  adminGraphqlApiId: string;
  title: string;
  status?: string | null;
}

function toShopifyGraphQlStatus(status: ShopifyProduct['status'] | undefined): ShopifyGraphQlProductStatus | undefined {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'archived':
      return 'ARCHIVED';
    case 'draft':
      return 'DRAFT';
    default:
      return undefined;
  }
}

function toShopifyGraphQlInventoryPolicy(value: string | undefined): ShopifyGraphQlInventoryPolicy | undefined {
  if (!value) return undefined;

  switch (value.trim().toLowerCase()) {
    case 'continue':
      return 'CONTINUE';
    case 'deny':
      return 'DENY';
    default:
      return undefined;
  }
}

function toShopifyGraphQlWeightUnit(value: string | undefined): ShopifyGraphQlWeightUnit | undefined {
  if (!value) return undefined;

  switch (value.trim().toLowerCase()) {
    case 'g':
    case 'gram':
    case 'grams':
      return 'GRAMS';
    case 'kg':
    case 'kilogram':
    case 'kilograms':
      return 'KILOGRAMS';
    case 'oz':
    case 'ounce':
    case 'ounces':
      return 'OUNCES';
    case 'lb':
    case 'lbs':
    case 'pound':
    case 'pounds':
      return 'POUNDS';
    default:
      return undefined;
  }
}

function parseShopifyNumericId(value: string | number): number {
  if (typeof value === 'number') return value;

  const match = value.match(/\/(\d+)(?:\?.*)?$/);
  if (!match) {
    throw new Error(`Unable to parse Shopify product ID from "${value}".`);
  }

  return Number(match[1]);
}

function toShopifyProductGid(productId: number): string {
  return `gid://shopify/Product/${productId}`;
}

function splitShopifyTags(tags: string | undefined): string[] | undefined {
  if (!tags) return undefined;

  const normalized = tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedProductOptions(options: ShopifyProduct['options']): ShopifyUnifiedProductSetOptionInput[] | undefined {
  if (!options || options.length === 0) return undefined;

  const normalized: ShopifyUnifiedProductSetOptionInput[] = options.reduce<ShopifyUnifiedProductSetOptionInput[]>((result, option, index) => {
      const name = option?.name?.trim();
      const values = Array.from(new Set((option?.values ?? []).map((value) => value.trim()).filter(Boolean)))
        .map((value) => ({ name: value }));

      if (!name || values.length === 0) return result;

      result.push({
        name,
        position: option?.position ?? index + 1,
        values,
      });

      return result;
    }, []);

  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedProductFiles(images: ShopifyProduct['images']): ShopifyUnifiedProductSetFileInput[] | undefined {
  if (!images || images.length === 0) return undefined;

  const normalized = [...images]
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
    .reduce<ShopifyUnifiedProductSetFileInput[]>((result, image) => {
      const originalSource = image?.src?.trim();
      if (!originalSource) return result;

      result.push({
        originalSource,
        alt: image.alt?.trim() || undefined,
        contentType: 'IMAGE',
      });

      return result;
    }, []);

  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedVariantInventoryItem(variant: ShopifyProductVariant): ShopifyUnifiedInventoryItemInput | undefined {
  const sku = variant.sku?.trim() || undefined;
  const tracked = variant.inventory_management?.trim().toLowerCase() === 'shopify' ? true : undefined;
  const requiresShipping = typeof variant.requires_shipping === 'boolean' ? variant.requires_shipping : undefined;
  const weightValue = typeof variant.weight === 'number' && Number.isFinite(variant.weight)
    ? variant.weight
    : undefined;
  const weightUnit = toShopifyGraphQlWeightUnit(variant.weight_unit);

  const inventoryItem: ShopifyUnifiedInventoryItemInput = {
    sku,
    tracked,
    requiresShipping,
    measurement: weightValue !== undefined && weightUnit
      ? {
          weight: {
            value: weightValue,
            unit: weightUnit,
          },
        }
      : undefined,
  };

  if (!inventoryItem.sku && inventoryItem.tracked === undefined && inventoryItem.requiresShipping === undefined && !inventoryItem.measurement) {
    return undefined;
  }

  return inventoryItem;
}

function buildUnifiedVariantOptionValues(
  variant: ShopifyProductVariant,
  options: ShopifyProduct['options'],
): ShopifyUnifiedVariantOptionValueInput[] {
  if (!options || options.length === 0) {
    return [];
  }

  const variantOptionValues = [variant.option1, variant.option2, variant.option3];

  return options
    .map((option, index) => {
      const optionName = option.name?.trim();
      const value = variantOptionValues[index]?.trim() || option.values?.[0]?.trim() || '';
      if (!optionName || !value) return null;

      return {
        optionName,
        name: value,
      } satisfies ShopifyUnifiedVariantOptionValueInput;
    })
    .filter((optionValue): optionValue is ShopifyUnifiedVariantOptionValueInput => optionValue !== null);
}

function buildUnifiedVariants(
  variants: ShopifyProduct['variants'],
  options: ShopifyProduct['options'],
): ShopifyUnifiedProductSetVariantInput[] | undefined {
  if (!variants || variants.length === 0) return undefined;

  const normalized = variants.map((variant, index) => ({
    optionValues: buildUnifiedVariantOptionValues(variant, options),
    price: typeof variant.price === 'string' && variant.price.trim().length > 0 ? variant.price.trim() : undefined,
    sku: variant.sku?.trim() || undefined,
    barcode: variant.barcode?.trim() || undefined,
    position: variant.position ?? index + 1,
    compareAtPrice: typeof variant.compare_at_price === 'string' && variant.compare_at_price.trim().length > 0
      ? variant.compare_at_price.trim()
      : undefined,
    inventoryPolicy: toShopifyGraphQlInventoryPolicy(variant.inventory_policy),
    inventoryItem: buildUnifiedVariantInventoryItem(variant),
    taxable: typeof variant.taxable === 'boolean' ? variant.taxable : undefined,
  } satisfies ShopifyUnifiedProductSetVariantInput));

  return normalized.length > 0 ? normalized : undefined;
}

export function buildShopifyUnifiedProductSetRequest(
  product: ShopifyProduct,
  options?: {
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  },
): ShopifyUnifiedProductSetRequest {
  const normalizedProduct = buildShopifyCreateProductRequestWithRequiredFields(product).product;
  const normalizedCategoryId = options?.categoryId?.trim();
  const unifiedOptions = buildUnifiedProductOptions(normalizedProduct.options);
  const unifiedVariants = buildUnifiedVariants(normalizedProduct.variants, normalizedProduct.options);
  const unifiedFiles = buildUnifiedProductFiles(normalizedProduct.images);

  return {
    input: {
      title: normalizedProduct.title?.trim() || 'Untitled Listing',
      descriptionHtml: normalizedProduct.body_html?.trim() || undefined,
      vendor: normalizedProduct.vendor?.trim() || undefined,
      productType: normalizedProduct.product_type?.trim() || undefined,
      handle: normalizedProduct.handle?.trim() || undefined,
      status: toShopifyGraphQlStatus(normalizedProduct.status),
      tags: splitShopifyTags(normalizedProduct.tags),
      templateSuffix: normalizedProduct.template_suffix?.trim() || undefined,
      category: normalizedCategoryId || undefined,
      collectionsToJoin: options?.collectionIds && options.collectionIds.length > 0
        ? options.collectionIds
        : undefined,
      metafields: normalizedProduct.metafields,
      files: unifiedFiles,
      productOptions: unifiedOptions,
      variants: unifiedVariants,
    },
    synchronous: true,
    identifier: options?.existingProductId
      ? { id: toShopifyProductGid(options.existingProductId) }
      : undefined,
  };
}

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
    const normalizedPayload = prepareShopifyCreateProductRequest(payload.product);
    const response = await this.client.post<ShopifyProductResponse>('/products.json', normalizedPayload);
    return response.data.product;
  }

  async upsertProductWithUnifiedRequest(
    request: ShopifyUnifiedProductSetRequest,
  ): Promise<ShopifyUnifiedProductResult> {
    const data = await this.graphQlRequest<{
      productSet: {
        product: {
          id: string;
          title: string;
          status?: string | null;
        } | null;
        userErrors: ShopifyGraphQlUserError[];
      };
    }>(
      `mutation ProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers, $synchronous: Boolean) {
        productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
          product {
            id
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
      request as unknown as Record<string, unknown>,
    );

    const userErrors = data.productSet.userErrors ?? [];
    if (userErrors.length > 0) {
      const message = userErrors
        .map((error) => error.message?.trim())
        .filter(Boolean)
        .join('; ');
      throw new Error(message || 'Shopify rejected the unified product mutation.');
    }

    const product = data.productSet.product;
    if (!product?.id) {
      throw new Error('Shopify product mutation returned no product ID.');
    }

    return {
      id: parseShopifyNumericId(product.id),
      adminGraphqlApiId: product.id,
      title: product.title,
      status: product.status,
    };
  }

  private async graphQlRequest<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const response = await this.client.post<ShopifyGraphQlResponse<TData>>('/graphql.json', {
      query,
      variables,
    });

    const graphQlErrors = response.data.errors ?? [];
    if (graphQlErrors.length > 0) {
      const message = graphQlErrors
        .map((error) => error.message?.trim())
        .filter(Boolean)
        .join('; ');
      throw new Error(message || 'Shopify GraphQL request failed.');
    }

    if (!response.data.data) {
      throw new Error('Shopify GraphQL request returned no data.');
    }

    return response.data.data;
  }

  async searchTaxonomyCategories(search: string, first = 10): Promise<ShopifyTaxonomyCategoryMatch[]> {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length === 0) {
      return this.getTaxonomyCategories(first);
    }

    const data = await this.graphQlRequest<{
      taxonomy: {
        categories: {
          edges: Array<{
            node: ShopifyTaxonomyCategoryMatch;
          }>;
        };
      };
    }>(
      `query SearchTaxonomyCategories($search: String!, $first: Int!) {
        taxonomy {
          categories(first: $first, search: $search) {
            edges {
              node {
                id
                fullName
                name
                isLeaf
              }
            }
          }
        }
      }`,
      {
        search: normalizedSearch,
        first,
      },
    );

    return data.taxonomy.categories.edges.map((edge) => edge.node);
  }

  async getTaxonomyCategories(first = 10): Promise<ShopifyTaxonomyCategoryMatch[]> {
    const data = await this.graphQlRequest<{
      taxonomy: {
        categories: {
          edges: Array<{
            node: ShopifyTaxonomyCategoryMatch;
          }>;
        };
      };
    }>(
      `query GetTaxonomyCategories($first: Int!) {
        taxonomy {
          categories(first: $first) {
            edges {
              node {
                id
                fullName
                name
                isLeaf
              }
            }
          }
        }
      }`,
      {
        first,
      },
    );

    return data.taxonomy.categories.edges.map((edge) => edge.node);
  }

  async searchCollections(search: string, first = 20): Promise<ShopifyCollectionMatch[]> {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length === 0) {
      return this.getCollections(first);
    }

    const data = await this.graphQlRequest<{
      collections: {
        edges: Array<{
          node: ShopifyCollectionMatch;
        }>;
      };
    }>(
      `query SearchCollections($query: String!, $first: Int!) {
        collections(first: $first, query: $query, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }`,
      {
        query: normalizedSearch,
        first,
      },
    );

    return data.collections.edges.map((edge) => edge.node);
  }

  async getCollections(first = 20): Promise<ShopifyCollectionMatch[]> {
    const data = await this.graphQlRequest<{
      collections: {
        edges: Array<{
          node: ShopifyCollectionMatch;
        }>;
      };
    }>(
      `query GetCollections($first: Int!) {
        collections(first: $first, sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }`,
      {
        first,
      },
    );

    return data.collections.edges.map((edge) => edge.node);
  }

  async resolveTaxonomyCategory(searchOrId: string): Promise<ShopifyTaxonomyCategoryMatch | null> {
    const normalized = searchOrId.trim();
    if (normalized.length === 0) return null;

    if (normalized.startsWith('gid://shopify/TaxonomyCategory/')) {
      return {
        id: normalized,
        fullName: normalized,
        name: normalized.split('/').pop() ?? normalized,
        isLeaf: true,
      };
    }

    const matches = await this.searchTaxonomyCategories(normalized);
    if (matches.length === 0) return null;

    const normalizedLower = normalized.toLowerCase();
    const exactFullName = matches.find((match) => match.fullName.toLowerCase() === normalizedLower);
    if (exactFullName) return exactFullName;

    const exactLeafNameMatches = matches.filter((match) => match.name.toLowerCase() === normalizedLower);
    if (exactLeafNameMatches.length === 1) return exactLeafNameMatches[0];

    if (matches.length === 1) return matches[0];

    return null;
  }

  async updateProductCategory(productId: number, categoryId: string): Promise<void> {
    const normalizedCategoryId = categoryId.trim();
    if (!normalizedCategoryId) return;

    const data = await this.graphQlRequest<{
      productUpdate: {
        userErrors: ShopifyGraphQlUserError[];
      };
    }>(
      `mutation UpdateProductCategory($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          userErrors {
            field
            message
          }
        }
      }`,
      {
        product: {
          id: `gid://shopify/Product/${productId}`,
          category: normalizedCategoryId,
        },
      },
    );

    const userErrors = data.productUpdate.userErrors ?? [];
    if (userErrors.length > 0) {
      const message = userErrors
        .map((error) => error.message?.trim())
        .filter(Boolean)
        .join('; ');
      throw new Error(message || 'Shopify rejected the product category update.');
    }
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
