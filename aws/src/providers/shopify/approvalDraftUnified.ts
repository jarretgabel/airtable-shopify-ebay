import type { ShopifyUnifiedProductSetRequest } from './client.js';
import {
  normalizeInventoryManagement,
  normalizePublishedScope,
  normalizeStatus,
  trimShopifyProductType,
} from './approvalDraftFieldUtils.js';
import type { ShopifyProduct, ShopifyProductVariant } from './approvalDraftTypes.js';

type ShopifyGraphQlProductStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
type ShopifyGraphQlInventoryPolicy = 'CONTINUE' | 'DENY';
type ShopifyGraphQlWeightUnit = 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS';

interface ShopifyUnifiedProductSetFileInput {
  originalSource: string;
  alt?: string;
  contentType: 'IMAGE';
}

interface ShopifyUnifiedProductSetOptionValueInput {
  name: string;
}

interface ShopifyUnifiedProductSetOptionInput {
  name: string;
  position?: number;
  values?: ShopifyUnifiedProductSetOptionValueInput[];
}

interface ShopifyUnifiedVariantOptionValueInput {
  optionName: string;
  name: string;
}

interface ShopifyUnifiedInventoryItemInput {
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

interface ShopifyUnifiedProductSetVariantInput {
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

function toShopifyGraphQlStatus(status: ShopifyProduct['status'] | undefined): ShopifyGraphQlProductStatus | undefined {
  if (status === 'active') return 'ACTIVE';
  if (status === 'archived') return 'ARCHIVED';
  if (status === 'draft') return 'DRAFT';
  return undefined;
}

function toShopifyGraphQlInventoryPolicy(value: string | undefined): ShopifyGraphQlInventoryPolicy | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'continue') return 'CONTINUE';
  if (normalized === 'deny') return 'DENY';
  return undefined;
}

function toShopifyGraphQlWeightUnit(value: string | undefined): ShopifyGraphQlWeightUnit | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['g', 'gram', 'grams'].includes(normalized)) return 'GRAMS';
  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) return 'KILOGRAMS';
  if (['oz', 'ounce', 'ounces'].includes(normalized)) return 'OUNCES';
  if (['lb', 'lbs', 'pound', 'pounds'].includes(normalized)) return 'POUNDS';
  return undefined;
}

function toShopifyProductGid(productId: number): string {
  return `gid://shopify/Product/${productId}`;
}

function splitShopifyTags(tags: string | undefined): string[] | undefined {
  if (!tags) return undefined;
  const normalized = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedProductOptions(options: ShopifyProduct['options']): ShopifyUnifiedProductSetOptionInput[] | undefined {
  if (!options || options.length === 0) return undefined;
  const normalized = options.reduce<ShopifyUnifiedProductSetOptionInput[]>((result, option, index) => {
    const name = option?.name?.trim();
    const values = Array.from(new Set((option?.values ?? []).map((value) => value.trim()).filter(Boolean))).map((value) => ({ name: value }));
    if (!name || values.length === 0) return result;
    result.push({ name, position: option?.position ?? index + 1, values });
    return result;
  }, []);
  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedProductFiles(images: ShopifyProduct['images']): ShopifyUnifiedProductSetFileInput[] | undefined {
  if (!images || images.length === 0) return undefined;
  const normalized = [...images].sort((left, right) => (left.position ?? 0) - (right.position ?? 0)).reduce<ShopifyUnifiedProductSetFileInput[]>((result, image) => {
    const originalSource = image?.src?.trim();
    if (!originalSource) return result;
    result.push({ originalSource, alt: image.alt?.trim() || undefined, contentType: 'IMAGE' });
    return result;
  }, []);
  return normalized.length > 0 ? normalized : undefined;
}

function buildUnifiedVariantInventoryItem(variant: ShopifyProductVariant): ShopifyUnifiedInventoryItemInput | undefined {
  const sku = variant.sku?.trim() || undefined;
  const tracked = normalizeInventoryManagement(variant.inventory_management) === 'shopify' ? true : undefined;
  const requiresShipping = typeof variant.requires_shipping === 'boolean' ? variant.requires_shipping : undefined;
  const weightValue = typeof variant.weight === 'number' && Number.isFinite(variant.weight) ? variant.weight : undefined;
  const weightUnit = toShopifyGraphQlWeightUnit(variant.weight_unit);
  const inventoryItem: ShopifyUnifiedInventoryItemInput = {
    sku,
    tracked,
    requiresShipping,
    measurement: weightValue !== undefined && weightUnit ? { weight: { value: weightValue, unit: weightUnit } } : undefined,
  };
  if (!inventoryItem.sku && inventoryItem.tracked === undefined && inventoryItem.requiresShipping === undefined && !inventoryItem.measurement) {
    return undefined;
  }
  return inventoryItem;
}

function buildUnifiedVariantOptionValues(variant: ShopifyProductVariant, options: ShopifyProduct['options']): ShopifyUnifiedVariantOptionValueInput[] {
  if (!options || options.length === 0) return [];
  const variantOptionValues = [variant.option1, variant.option2, variant.option3];
  return options.map((option, index) => {
    const optionName = option.name?.trim();
    const value = variantOptionValues[index]?.trim() || option.values?.[0]?.trim() || '';
    if (!optionName || !value) return null;
    return { optionName, name: value } satisfies ShopifyUnifiedVariantOptionValueInput;
  }).filter((optionValue): optionValue is ShopifyUnifiedVariantOptionValueInput => optionValue !== null);
}

function buildUnifiedVariants(variants: ShopifyProduct['variants'], options: ShopifyProduct['options']): ShopifyUnifiedProductSetVariantInput[] | undefined {
  if (!variants || variants.length === 0) return undefined;
  const normalized = variants.map((variant, index) => ({
    optionValues: buildUnifiedVariantOptionValues(variant, options),
    price: typeof variant.price === 'string' && variant.price.trim().length > 0 ? variant.price.trim() : undefined,
    sku: variant.sku?.trim() || undefined,
    barcode: variant.barcode?.trim() || undefined,
    position: variant.position ?? index + 1,
    compareAtPrice: typeof variant.compare_at_price === 'string' && variant.compare_at_price.trim().length > 0 ? variant.compare_at_price.trim() : undefined,
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
    status: normalizeStatus(product.status) ?? 'draft',
    published_scope: normalizePublishedScope(product.published_scope) ?? 'web',
    template_suffix: typeof product.template_suffix === 'string' && product.template_suffix.trim().length > 0 ? product.template_suffix : 'product-template',
    variants: (Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : [{} as ShopifyProductVariant]).map((variant, index) => {
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
    }),
  };
}

export function buildShopifyUnifiedProductSetRequest(
  product: ShopifyProduct,
  options?: { categoryId?: string; collectionIds?: string[]; existingProductId?: number },
): ShopifyUnifiedProductSetRequest {
  const normalizedProduct = normalizeShopifyProductForUpsert(product);
  const normalizedCategoryId = options?.categoryId?.trim();
  const isExistingProductUpdate = Boolean(options?.existingProductId);
  return {
    input: {
      title: normalizedProduct.title?.trim() || 'Untitled Listing',
      descriptionHtml: normalizedProduct.body_html?.trim() || undefined,
      vendor: normalizedProduct.vendor?.trim() || undefined,
      productType: trimShopifyProductType(normalizedProduct.product_type ?? '') || undefined,
      handle: isExistingProductUpdate ? undefined : (normalizedProduct.handle?.trim() || undefined),
      status: toShopifyGraphQlStatus(normalizedProduct.status),
      tags: splitShopifyTags(normalizedProduct.tags),
      templateSuffix: normalizedProduct.template_suffix?.trim() || undefined,
      category: normalizedCategoryId || undefined,
      metafields: normalizedProduct.metafields,
      files: buildUnifiedProductFiles(normalizedProduct.images),
      productOptions: buildUnifiedProductOptions(normalizedProduct.options),
      variants: buildUnifiedVariants(normalizedProduct.variants, normalizedProduct.options),
    },
    synchronous: true,
    identifier: options?.existingProductId ? { id: toShopifyProductGid(options.existingProductId) } : undefined,
  };
}