import {
  ShopifyMetafield,
  ShopifyProduct,
  ShopifyProductVariant,
} from '@/types/shopify';

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
    const price = priceRaw.length > 0 ? priceRaw : undefined;

    return {
      ...variant,
      ...(price ? { price } : {}),
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
