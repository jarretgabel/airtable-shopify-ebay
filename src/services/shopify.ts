import axios, { AxiosInstance } from 'axios';
import { requireEnv, requireOneOfEnv } from '@/config/runtimeEnv';
import { logServiceError } from '@/services/logger';
import {
  ShopifyMetafield,
  ShopifyProduct,
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

interface ShopifyStagedUploadParameter {
  name: string;
  value: string;
}

interface ShopifyStagedUploadTarget {
  url: string;
  resourceUrl: string;
  parameters: ShopifyStagedUploadParameter[];
}

export interface ShopifyUploadedImageResult {
  id: string;
  url: string;
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
  isSmartCollection?: boolean;
}

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

export interface ShopifyUnifiedUpsertWithCollectionsResult {
  product: ShopifyUnifiedProductResult;
  collectionFailures: string[];
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

export function normalizeShopifyProductForUpsert(product: ShopifyProduct): ShopifyProduct {
  return {
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
}

export function buildShopifyUnifiedProductSetRequest(
  product: ShopifyProduct,
  options?: {
    categoryId?: string;
    collectionIds?: string[];
    existingProductId?: number;
  },
): ShopifyUnifiedProductSetRequest {
  const normalizedProduct = normalizeShopifyProductForUpsert(product);
  const normalizedCategoryId = options?.categoryId?.trim();
  const isExistingProductUpdate = Boolean(options?.existingProductId);
  const unifiedOptions = buildUnifiedProductOptions(normalizedProduct.options);
  const unifiedVariants = buildUnifiedVariants(normalizedProduct.variants, normalizedProduct.options);
  const unifiedFiles = buildUnifiedProductFiles(normalizedProduct.images);

  return {
    input: {
      title: normalizedProduct.title?.trim() || 'Untitled Listing',
      descriptionHtml: normalizedProduct.body_html?.trim() || undefined,
      vendor: normalizedProduct.vendor?.trim() || undefined,
      productType: normalizedProduct.product_type?.trim() || undefined,
      // On update, avoid forcing handle changes that can collide with existing products.
      handle: isExistingProductUpdate ? undefined : (normalizedProduct.handle?.trim() || undefined),
      status: toShopifyGraphQlStatus(normalizedProduct.status),
      tags: splitShopifyTags(normalizedProduct.tags),
      templateSuffix: normalizedProduct.template_suffix?.trim() || undefined,
      category: normalizedCategoryId || undefined,
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
  return {
    product: normalizeShopifyProductForUpsert(product),
  };
}

export interface ShopifyCreateProductRequest {
  product: ShopifyProduct;
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

  async getProduct(id: number): Promise<ShopifyUnifiedProductResult | null> {
    const data = await this.graphQlRequest<{
      product: {
        id: string;
        title: string;
        status?: string | null;
      } | null;
    }>(
      `query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          status
        }
      }`,
      {
        id: toShopifyProductGid(id),
      },
    );

    if (!data.product?.id) {
      return null;
    }

    return {
      id: parseShopifyNumericId(data.product.id),
      adminGraphqlApiId: data.product.id,
      title: data.product.title,
      status: data.product.status,
    };
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

  async upsertExistingProductWithCollectionsInSingleMutation(
    request: ShopifyUnifiedProductSetRequest,
    collectionIds: string[],
  ): Promise<ShopifyUnifiedUpsertWithCollectionsResult> {
    if (!request.identifier?.id) {
      throw new Error('Single-mutation collection update requires an existing Shopify product ID identifier.');
    }

    const normalizedCollectionIds = Array.from(
      new Set(
        collectionIds
          .map((collectionId) => collectionId.trim())
          .filter((collectionId) => /^gid:\/\/shopify\/Collection\/\d+$/i.test(collectionId)),
      ),
    );

    if (normalizedCollectionIds.length === 0) {
      const product = await this.upsertProductWithUnifiedRequest(request);
      return {
        product,
        collectionFailures: [],
      };
    }

    const variableDefs: string[] = [
      '$input: ProductSetInput!',
      '$identifier: ProductSetIdentifiers!',
      '$synchronous: Boolean',
      '$productIds: [ID!]!',
    ];

    const mutationFields: string[] = [
      `productSet(input: $input, identifier: $identifier, synchronous: $synchronous) {
        product {
          id
          title
          status
        }
        userErrors {
          field
          message
        }
      }`,
    ];

    const variables: Record<string, unknown> = {
      input: request.input,
      identifier: request.identifier,
      synchronous: request.synchronous,
      productIds: [request.identifier.id],
    };

    normalizedCollectionIds.forEach((collectionId, index) => {
      const variableName = `collectionId${index}`;
      variableDefs.push(`$${variableName}: ID!`);
      mutationFields.push(
        `collectionJoin${index}: collectionAddProducts(id: $${variableName}, productIds: $productIds) {
          userErrors {
            field
            message
          }
        }`,
      );
      variables[variableName] = collectionId;
    });

    const mutation = `mutation UpsertProductAndJoinCollections(${variableDefs.join(', ')}) {
      ${mutationFields.join('\n')}
    }`;

    const data = await this.graphQlRequest<{
      productSet: {
        product: {
          id: string;
          title: string;
          status?: string | null;
        } | null;
        userErrors: ShopifyGraphQlUserError[];
      };
      [key: string]: unknown;
    }>(mutation, variables);

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

    const collectionFailures: string[] = [];
    normalizedCollectionIds.forEach((collectionId, index) => {
      const key = `collectionJoin${index}`;
      const mutationResult = data[key] as { userErrors?: ShopifyGraphQlUserError[] } | undefined;
      const joinErrors = mutationResult?.userErrors ?? [];
      if (joinErrors.length === 0) return;

      const message = joinErrors
        .map((error) => error.message?.trim())
        .filter(Boolean)
        .join('; ');

      collectionFailures.push(`${collectionId}: ${message || 'Shopify rejected this collection assignment.'}`);
    });

    return {
      product: {
        id: parseShopifyNumericId(product.id),
        adminGraphqlApiId: product.id,
        title: product.title,
        status: product.status,
      },
      collectionFailures,
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

  async searchCollections(search: string, first = 250): Promise<ShopifyCollectionMatch[]> {
    const normalizedSearch = search.trim();
    if (normalizedSearch.length === 0) {
      return this.getCollections(first);
    }

    const builtQuery = `collection_type:custom ${normalizedSearch}`.trim();
    const data = await this.graphQlRequest<{
      collections: {
        edges: Array<{ node: ShopifyCollectionMatch }>;
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
      { query: builtQuery, first },
    );

    const collections = data.collections.edges.map((edge) => edge.node);
    console.info('[Shopify] Manual collections fetched (search)', {
      search: normalizedSearch,
      count: collections.length,
      collections: collections.map((c) => ({ id: c.id, title: c.title })),
    });
    return collections;
  }

  async getCollections(first = 250): Promise<ShopifyCollectionMatch[]> {
    const data = await this.graphQlRequest<{
      collections: {
        edges: Array<{ node: ShopifyCollectionMatch }>;
      };
    }>(
      `query GetCollections($first: Int!) {
        collections(first: $first, query: "collection_type:custom", sortKey: TITLE) {
          edges {
            node {
              id
              title
              handle
            }
          }
        }
      }`,
      { first },
    );

    const collections = data.collections.edges.map((edge) => edge.node);
    console.info('[Shopify] Manual collections fetched (initial)', {
      count: collections.length,
      collections: collections.map((c) => ({ id: c.id, title: c.title })),
    });
    return collections;
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

  async uploadImageFile(file: File, alt?: string): Promise<ShopifyUploadedImageResult> {
    const stagedData = await this.graphQlRequest<{
      stagedUploadsCreate: {
        stagedTargets: ShopifyStagedUploadTarget[];
        userErrors: ShopifyGraphQlUserError[];
      };
    }>(
      `mutation CreateStagedImageUpload($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        input: [
          {
            filename: file.name,
            mimeType: file.type || 'image/jpeg',
            resource: 'IMAGE',
            httpMethod: 'POST',
            fileSize: String(file.size),
          },
        ],
      },
    );

    const stagedErrors = stagedData.stagedUploadsCreate.userErrors ?? [];
    if (stagedErrors.length > 0) {
      throw new Error(stagedErrors.map((error) => error.message.trim()).filter(Boolean).join('; ') || 'Shopify staged upload failed.');
    }

    const stagedTarget = stagedData.stagedUploadsCreate.stagedTargets[0];
    if (!stagedTarget?.url || !stagedTarget.resourceUrl) {
      throw new Error('Shopify did not return a staged upload target.');
    }

    const formData = new FormData();
    stagedTarget.parameters.forEach((parameter) => {
      formData.append(parameter.name, parameter.value);
    });
    formData.append('file', file, file.name);

    const stagedUploadResponse = await fetch(stagedTarget.url, {
      method: 'POST',
      body: formData,
    });

    if (!stagedUploadResponse.ok) {
      throw new Error(`Shopify staged binary upload failed (${stagedUploadResponse.status}).`);
    }

    const fileCreateData = await this.graphQlRequest<{
      fileCreate: {
        files: Array<{
          id?: string | null;
          fileStatus?: string | null;
          image?: {
            url?: string | null;
          } | null;
          preview?: {
            image?: {
              url?: string | null;
            } | null;
          } | null;
        }>;
        userErrors: ShopifyGraphQlUserError[];
      };
    }>(
      `mutation CreateShopifyImageFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on MediaImage {
              id
              fileStatus
              image {
                url
              }
              preview {
                image {
                  url
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        files: [
          {
            alt: alt?.trim() || undefined,
            contentType: 'IMAGE',
            originalSource: stagedTarget.resourceUrl,
          },
        ],
      },
    );

    const fileCreateErrors = fileCreateData.fileCreate.userErrors ?? [];
    if (fileCreateErrors.length > 0) {
      throw new Error(fileCreateErrors.map((error) => error.message.trim()).filter(Boolean).join('; ') || 'Shopify rejected the uploaded image.');
    }

    const createdFile = fileCreateData.fileCreate.files[0];
    const url = createdFile?.image?.url?.trim() || createdFile?.preview?.image?.url?.trim() || stagedTarget.resourceUrl;
    if (!createdFile?.id || !url) {
      throw new Error('Shopify uploaded the image but returned no file URL.');
    }

    return {
      id: createdFile.id,
      url,
    };
  }

  async addProductToCollections(productId: number, collectionIds: string[]): Promise<void> {
    if (!Number.isFinite(productId) || productId <= 0 || collectionIds.length === 0) return;

    const productGid = `gid://shopify/Product/${productId}`;
    const normalizedCollectionIds = Array.from(
      new Set(
        collectionIds
          .map((collectionId) => collectionId.trim())
          .filter((collectionId) => /^gid:\/\/shopify\/Collection\/\d+$/i.test(collectionId)),
      ),
    );

    const assignmentFailures: string[] = [];

    for (const collectionId of normalizedCollectionIds) {
      const data = await this.graphQlRequest<{
        collectionAddProducts: {
          userErrors: ShopifyGraphQlUserError[];
        };
      }>(
        `mutation AddProductToCollection($id: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $id, productIds: $productIds) {
            userErrors {
              field
              message
            }
          }
        }`,
        {
          id: collectionId,
          productIds: [productGid],
        },
      );

      const userErrors = data.collectionAddProducts.userErrors ?? [];
      if (userErrors.length > 0) {
        const message = userErrors
          .map((error) => error.message?.trim())
          .filter(Boolean)
          .join('; ');
        assignmentFailures.push(`${collectionId}: ${message || 'Shopify rejected this collection assignment.'}`);
      }
    }

    if (assignmentFailures.length > 0) {
      throw new Error(`Collection assignment failed for ${assignmentFailures.length} collection(s): ${assignmentFailures.join(' | ')}`);
    }
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
