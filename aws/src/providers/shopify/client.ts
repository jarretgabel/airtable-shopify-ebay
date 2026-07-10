import { HttpError } from '../../shared/errors.js';
import { requireSecret } from '../../shared/secrets.js';

export type ShopifyWebhookTopic =
  | 'ORDERS_UPDATED'
  | 'REFUNDS_CREATE'
  | 'DISPUTES_CREATE'
  | 'DISPUTES_UPDATE'
  | 'RETURNS_APPROVE';

export type ShopifyWebhookSubscriptionKey =
  | 'ORDERS_PAID'
  | 'ORDERS_CANCELLED'
  | 'REFUNDS_CREATE'
  | 'DISPUTES_CREATE'
  | 'DISPUTES_UPDATE'
  | 'RETURNS_PROCESS';

export interface ShopifyWebhookSubscriptionConfig {
  key: ShopifyWebhookSubscriptionKey;
  topic: ShopifyWebhookTopic;
  callbackPath: string;
}

export interface ShopifyWebhookSubscriptionRecord {
  id: string;
  topic: ShopifyWebhookTopic;
  callbackUrl: string;
}

export interface ShopifyWebhookRegistrationResult {
  created: ShopifyWebhookSubscriptionRecord[];
  existing: ShopifyWebhookSubscriptionRecord[];
}

const SHOPIFY_WEBHOOK_SUBSCRIPTIONS: ShopifyWebhookSubscriptionConfig[] = [
  { key: 'ORDERS_PAID', topic: 'ORDERS_UPDATED', callbackPath: '/api/hooks/shopify/orders-paid' },
  { key: 'ORDERS_CANCELLED', topic: 'ORDERS_UPDATED', callbackPath: '/api/hooks/shopify/orders-cancelled' },
  { key: 'REFUNDS_CREATE', topic: 'REFUNDS_CREATE', callbackPath: '/api/hooks/shopify/refunds-create' },
  { key: 'DISPUTES_CREATE', topic: 'DISPUTES_CREATE', callbackPath: '/api/hooks/shopify/disputes-create' },
  { key: 'DISPUTES_UPDATE', topic: 'DISPUTES_UPDATE', callbackPath: '/api/hooks/shopify/disputes-update' },
  { key: 'RETURNS_PROCESS', topic: 'RETURNS_APPROVE', callbackPath: '/api/hooks/shopify/returns-process' },
];

/**
 * Maps internal topic representation to Shopify's GraphQL WebhookSubscriptionTopic enum.
 * Shopify uses UPPER_SNAKE_CASE format (e.g., 'ORDERS_PAID').
 */
function mapToShopifyWebhookTopic(topic: ShopifyWebhookTopic): string {
  // The internal format already matches Shopify's GraphQL enum format
  return topic;
}

/**
 * Maps Shopify's WebhookSubscriptionTopic back to our internal representation.
 */
function mapFromShopifyWebhookTopic(shopifyTopic: string): ShopifyWebhookTopic | null {
  const validTopics: Record<string, ShopifyWebhookTopic> = {
    'ORDERS_UPDATED': 'ORDERS_UPDATED',
    'REFUNDS_CREATE': 'REFUNDS_CREATE',
    'DISPUTES_CREATE': 'DISPUTES_CREATE',
    'DISPUTES_UPDATE': 'DISPUTES_UPDATE',
    'RETURNS_APPROVE': 'RETURNS_APPROVE',
  };
  return validTopics[shopifyTopic] ?? null;
}

export async function getCurrentShopifyAccessScopes(): Promise<string[]> {
  const data = await graphQlRequest<{
    currentAppInstallation: {
      accessScopes: Array<{ handle?: string | null }>;
    } | null;
  }>(
    `query CurrentShopifyAccessScopes {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
    }`,
    {},
  );

  return (data.currentAppInstallation?.accessScopes ?? [])
    .map((scope) => scope.handle?.trim() ?? '')
    .filter((scope): scope is string => scope.length > 0);
}

export interface ShopifyProductRecord {
  id: number;
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
  options?: Array<{
    id?: number;
    name: string;
    position?: number;
    values: string[];
  }>;
  variants?: Array<{
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
  }>;
  images?: Array<{
    id?: number;
    src: string;
    alt?: string;
    position?: number;
    variant_ids?: number[];
  }>;
  metafields?: Array<{
    id?: number;
    namespace: string;
    key: string;
    type: string;
    value: string;
  }>;
  created_at: string;
  updated_at: string;
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

export interface ShopifyUnifiedProductResult {
  id: number;
  adminGraphqlApiId: string;
  title: string;
  status?: string | null;
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
  metafields?: ShopifyProductRecord['metafields'];
  productOptions?: ShopifyUnifiedProductSetOptionInput[];
  variants?: ShopifyUnifiedProductSetVariantInput[];
}

export interface ShopifyUnifiedProductSetRequest {
  input: ShopifyUnifiedProductSetInput;
  synchronous: true;
  identifier?: ShopifyUnifiedProductSetIdentifier;
}

export interface ShopifyUnifiedUpsertWithCollectionsResult {
  product: ShopifyUnifiedProductResult;
  collectionFailures: string[];
}

function ensureConditionMetafieldInRequest(request: ShopifyUnifiedProductSetRequest): ShopifyUnifiedProductSetRequest {
  const existingMetafields = request.input.metafields ?? [];
  type ShopifyUnifiedMetafield = NonNullable<ShopifyUnifiedProductSetInput['metafields']>[number];
  const deduped = new Map<string, ShopifyUnifiedMetafield>();

  deduped.set('custom:condition', {
    namespace: 'custom',
    key: 'condition',
    type: 'single_line_text_field',
    value: 'Pre-Owned',
  });

  existingMetafields.forEach((metafield) => {
    const namespace = metafield?.namespace?.trim();
    const key = metafield?.key?.trim();
    const type = metafield?.type?.trim();
    const value = metafield?.value?.trim();
    if (!namespace || !key || !type || !value) return;

    deduped.set(`${namespace.toLowerCase()}:${key.toLowerCase()}`, {
      ...metafield,
      namespace,
      key,
      type,
      value,
    });
  });

  return {
    ...request,
    input: {
      ...request.input,
      metafields: Array.from(deduped.values()),
    },
  };
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

interface ShopifyProductsResponse {
  products: ShopifyProductRecord[];
}

interface ShopifyGraphQlError {
  message?: string;
}

interface ShopifyGraphQlResponse<TData> {
  data?: TData;
  errors?: ShopifyGraphQlError[];
}

function getShopifyWebhookBaseUrl(): string {
  const baseUrl = requireSecret('SHOPIFY_WEBHOOK_BASE_URL').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl)) {
    throw new HttpError(500, 'Shopify webhook base URL must use HTTPS.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_BASE_URL_INVALID',
      retryable: false,
    });
  }

  return baseUrl;
}

function buildShopifyWebhookCallbackUrl(callbackPath: string): string {
  const normalizedPath = callbackPath.startsWith('/') ? callbackPath : `/${callbackPath}`;
  return `${getShopifyWebhookBaseUrl()}${normalizedPath}`;
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

async function graphQlRequest<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
  const storeDomain = requireSecret('SHOPIFY_STORE_DOMAIN');
  const accessToken = requireSecret('SHOPIFY_ACCESS_TOKEN');
  const response = await fetch(`https://${storeDomain}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json().catch(() => ({})) as ShopifyGraphQlResponse<TData>;
  if (!response.ok) {
    throw new HttpError(response.status, 'Shopify GraphQL request failed.', {
      service: 'shopify',
      code: 'SHOPIFY_GRAPHQL_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  const graphQlErrors = body.errors ?? [];
  if (graphQlErrors.length > 0) {
    const message = graphQlErrors
      .map((error) => error.message?.trim())
      .filter(Boolean)
      .join('; ');
    throw new HttpError(502, message || 'Shopify GraphQL request failed.', {
      service: 'shopify',
      code: 'SHOPIFY_GRAPHQL_ERROR',
      retryable: false,
    });
  }

  if (!body.data) {
    throw new HttpError(502, 'Shopify GraphQL request returned no data.', {
      service: 'shopify',
      code: 'SHOPIFY_GRAPHQL_EMPTY_DATA',
      retryable: false,
    });
  }

  return body.data;
}

export function getRequiredShopifyWebhookSubscriptions(): ShopifyWebhookSubscriptionConfig[] {
  return [...SHOPIFY_WEBHOOK_SUBSCRIPTIONS];
}

export function getRequiredShopifyWebhookCallbackUrl(key: ShopifyWebhookSubscriptionKey): string {
  const subscription = SHOPIFY_WEBHOOK_SUBSCRIPTIONS.find((item) => item.key === key);
  if (!subscription) {
    throw new HttpError(500, `Unsupported Shopify webhook key: ${key}`, {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_TOPIC_UNSUPPORTED',
      retryable: false,
    });
  }

  return buildShopifyWebhookCallbackUrl(subscription.callbackPath);
}

export async function listWebhookSubscriptions(): Promise<ShopifyWebhookSubscriptionRecord[]> {
  const data = await graphQlRequest<{
    webhookSubscriptions: {
      edges: Array<{
        node: {
          id: string;
          topic: string;
          endpoint?: {
            __typename: string;
            callbackUrl?: string | null;
          } | null;
        };
      }>;
    };
  }>(
    `query ListWebhookSubscriptions($first: Int!) {
      webhookSubscriptions(first: $first) {
        edges {
          node {
            id
            topic
            endpoint {
              __typename
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
          }
        }
      }
    }`,
    { first: 50 },
  );

  return (data.webhookSubscriptions.edges ?? [])
    .map((edge) => {
      const callbackUrl = edge.node.endpoint?.__typename === 'WebhookHttpEndpoint'
        ? edge.node.endpoint.callbackUrl?.trim() ?? ''
        : '';
      if (!edge.node.id || !edge.node.topic || !callbackUrl) {
        return null;
      }

      const topic = mapFromShopifyWebhookTopic(edge.node.topic);
      if (!topic) {
        return null;
      }

      return {
        id: edge.node.id,
        topic,
        callbackUrl,
      } satisfies ShopifyWebhookSubscriptionRecord;
    })
    .filter((subscription): subscription is ShopifyWebhookSubscriptionRecord => subscription !== null);
}

export async function registerWebhookSubscription(topic: ShopifyWebhookTopic, callbackUrl: string): Promise<ShopifyWebhookSubscriptionRecord> {
  const shopifyTopic = mapToShopifyWebhookTopic(topic);
  const data = await graphQlRequest<{
    webhookSubscriptionCreate: {
      webhookSubscription: {
        id: string;
        topic: string;
        endpoint?: {
          __typename: string;
          callbackUrl?: string | null;
        } | null;
      } | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation RegisterWebhookSubscription($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
      webhookSubscriptionCreate(
        topic: $topic
        webhookSubscription: {
          callbackUrl: $callbackUrl,
          format: JSON
        }
      ) {
        webhookSubscription {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
        userErrors {
          message
        }
      }
    }`,
    { topic: shopifyTopic, callbackUrl },
  );

  const userErrors = data.webhookSubscriptionCreate.userErrors ?? [];
  if (userErrors.length > 0) {
    const message = userErrors.map((error) => error.message?.trim()).filter(Boolean).join('; ');
    throw new HttpError(502, message || 'Shopify rejected webhook registration.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_REGISTRATION_FAILED',
      retryable: false,
    });
  }

  const subscription = data.webhookSubscriptionCreate.webhookSubscription;
  const createdCallbackUrl = subscription?.endpoint?.__typename === 'WebhookHttpEndpoint'
    ? subscription.endpoint.callbackUrl?.trim() ?? ''
    : '';
  if (!subscription?.id || !subscription.topic || !createdCallbackUrl) {
    throw new HttpError(502, 'Shopify webhook registration returned no subscription.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_REGISTRATION_EMPTY',
      retryable: false,
    });
  }

  const mappedTopic = mapFromShopifyWebhookTopic(subscription.topic);
  if (!mappedTopic) {
    throw new HttpError(502, 'Shopify webhook registration returned unsupported topic.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_TOPIC_UNSUPPORTED',
      retryable: false,
    });
  }

  return {
    id: subscription.id,
    topic: mappedTopic,
    callbackUrl: createdCallbackUrl,
  };
}

export async function deleteWebhookSubscription(id: string): Promise<void> {
  const data = await graphQlRequest<{
    webhookSubscriptionDelete: {
      deletedWebhookSubscriptionId: string | null;
      userErrors: Array<{ message: string }>;
    };
  }>(
    `mutation DeleteWebhookSubscription($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        deletedWebhookSubscriptionId
        userErrors {
          message
        }
      }
    }`,
    { id },
  );

  const userErrors = data.webhookSubscriptionDelete.userErrors ?? [];
  if (userErrors.length > 0) {
    const message = userErrors.map((error) => error.message?.trim()).filter(Boolean).join('; ');
    throw new HttpError(502, message || 'Shopify rejected webhook deletion.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_DELETE_FAILED',
      retryable: false,
    });
  }

  if (!data.webhookSubscriptionDelete.deletedWebhookSubscriptionId) {
    throw new HttpError(502, 'Shopify webhook deletion returned no subscription id.', {
      service: 'shopify',
      code: 'SHOPIFY_WEBHOOK_DELETE_EMPTY',
      retryable: false,
    });
  }
}

export async function ensureRequiredWebhookSubscriptions(): Promise<ShopifyWebhookRegistrationResult> {
  const existingSubscriptions = await listWebhookSubscriptions();
  const created: ShopifyWebhookSubscriptionRecord[] = [];
  const existing: ShopifyWebhookSubscriptionRecord[] = [];

  for (const subscription of SHOPIFY_WEBHOOK_SUBSCRIPTIONS) {
    const callbackUrl = buildShopifyWebhookCallbackUrl(subscription.callbackPath);
    const match = existingSubscriptions.find((item) => item.topic === subscription.topic && item.callbackUrl === callbackUrl);
    if (match) {
      existing.push(match);
      continue;
    }

    created.push(await registerWebhookSubscription(subscription.topic, callbackUrl));
  }

  return { created, existing };
}

export async function getProducts(limit = 50): Promise<ShopifyProductRecord[]> {
  const storeDomain = requireSecret('SHOPIFY_STORE_DOMAIN');
  const accessToken = requireSecret('SHOPIFY_ACCESS_TOKEN');
  const url = new URL(`https://${storeDomain}/admin/api/2024-04/products.json`);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  const body = await response.json().catch(() => ({})) as ShopifyProductsResponse & { errors?: string };
  if (!response.ok) {
    throw new HttpError(response.status, `Shopify API error: HTTP ${response.status} on /products.json`, {
      service: 'shopify',
      code: 'SHOPIFY_HTTP_ERROR',
      retryable: response.status >= 500,
    });
  }

  return body.products ?? [];
}

export async function getProduct(id: number): Promise<ShopifyUnifiedProductResult | null> {
  const data = await graphQlRequest<{
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
    { id: toShopifyProductGid(id) },
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

export async function upsertProductWithUnifiedRequest(
  request: ShopifyUnifiedProductSetRequest,
): Promise<ShopifyUnifiedProductResult> {
  const ensuredRequest = ensureConditionMetafieldInRequest(request);
  const data = await graphQlRequest<{
    productSet: {
      product: {
        id: string;
        title: string;
        status?: string | null;
      } | null;
      userErrors: Array<{ message: string }>;
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
    ensuredRequest as unknown as Record<string, unknown>,
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

export async function upsertExistingProductWithCollectionsInSingleMutation(
  request: ShopifyUnifiedProductSetRequest,
  collectionIds: string[],
): Promise<ShopifyUnifiedUpsertWithCollectionsResult> {
  const ensuredRequest = ensureConditionMetafieldInRequest(request);
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
    const product = await upsertProductWithUnifiedRequest(request);
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
    input: ensuredRequest.input,
    identifier: ensuredRequest.identifier,
    synchronous: ensuredRequest.synchronous,
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

  const data = await graphQlRequest<{
    productSet: {
      product: {
        id: string;
        title: string;
        status?: string | null;
      } | null;
      userErrors: Array<{ message: string }>;
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
    const mutationResult = data[key] as { userErrors?: Array<{ message: string }> } | undefined;
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

export async function getCollections(first = 250): Promise<ShopifyCollectionMatch[]> {
  const data = await graphQlRequest<{
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

  return data.collections.edges.map((edge) => edge.node);
}

export async function searchCollections(search: string, first = 250): Promise<ShopifyCollectionMatch[]> {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) {
    return getCollections(first);
  }

  const data = await graphQlRequest<{
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
    {
      query: `collection_type:custom ${normalizedSearch}`.trim(),
      first,
    },
  );

  return data.collections.edges.map((edge) => edge.node);
}

export async function searchTaxonomyCategories(search: string, first = 10): Promise<ShopifyTaxonomyCategoryMatch[]> {
  const normalizedSearch = search.trim();
  if (!normalizedSearch) {
    return [];
  }

  const data = await graphQlRequest<{
    taxonomy: {
      categories: {
        edges: Array<{ node: ShopifyTaxonomyCategoryMatch }>;
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
    { search: normalizedSearch, first },
  );

  return data.taxonomy.categories.edges.map((edge) => edge.node);
}

export async function resolveTaxonomyCategory(searchOrId: string): Promise<ShopifyTaxonomyCategoryMatch | null> {
  const normalized = searchOrId.trim();
  if (!normalized) return null;

  if (normalized.startsWith('gid://shopify/TaxonomyCategory/')) {
    return {
      id: normalized,
      fullName: normalized,
      name: normalized.split('/').pop() ?? normalized,
      isLeaf: true,
    };
  }

  const matches = await searchTaxonomyCategories(normalized);
  if (matches.length === 0) return null;

  const normalizedLower = normalized.toLowerCase();
  const exactFullName = matches.find((match) => match.fullName.toLowerCase() === normalizedLower);
  if (exactFullName) return exactFullName;

  const exactLeafNameMatches = matches.filter((match) => match.name.toLowerCase() === normalizedLower);
  if (exactLeafNameMatches.length === 1) return exactLeafNameMatches[0];

  if (matches.length === 1) return matches[0];

  return null;
}

export async function addProductToCollections(productId: number, collectionIds: string[]): Promise<void> {
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
    const data = await graphQlRequest<{
      collectionAddProducts: {
        userErrors: Array<{ message: string }>;
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

export async function updateProductCategory(productId: number, categoryId: string): Promise<void> {
  const normalizedCategoryId = categoryId.trim();
  if (!normalizedCategoryId) return;

  const data = await graphQlRequest<{
    productUpdate: {
      userErrors: Array<{ message: string }>;
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

export async function uploadImageFile(
  filename: string,
  mimeType: string,
  file: string,
  alt?: string,
): Promise<ShopifyUploadedImageResult> {
  const stagedData = await graphQlRequest<{
    stagedUploadsCreate: {
      stagedTargets: ShopifyStagedUploadTarget[];
      userErrors: Array<{ message: string }>;
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
          filename,
          mimeType,
          resource: 'IMAGE',
          httpMethod: 'POST',
          fileSize: String(Buffer.from(file, 'base64').byteLength),
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
  formData.append('file', new Blob([Buffer.from(file, 'base64')], { type: mimeType || 'image/jpeg' }), filename);

  const stagedUploadResponse = await fetch(stagedTarget.url, {
    method: 'POST',
    body: formData,
  });

  if (!stagedUploadResponse.ok) {
    throw new Error(`Shopify staged binary upload failed (${stagedUploadResponse.status}).`);
  }

  const fileCreateData = await graphQlRequest<{
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
      userErrors: Array<{ message: string }>;
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