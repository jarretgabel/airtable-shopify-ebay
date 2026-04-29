import { getHandleField, resolveShopifyBodyHtml } from './approvalDraftBody.js';
import {
  getField,
  getRawField,
  normalizeConditionLabel,
  normalizeInventoryManagement,
  normalizeInventoryPolicy,
  normalizePublishedScope,
  normalizeStatus,
  normalizeWeightUnit,
  parseBoolean,
  parseInteger,
  parseJsonArray,
  parseNumber,
  toMoneyString,
  trimShopifyProductType,
} from './approvalDraftFieldUtils.js';
import { buildImages } from './approvalDraftImages.js';
import { buildTags } from './approvalDraftTags.js';
import type { ApprovalFieldMap, ShopifyMetafield, ShopifyProduct, ShopifyProductOption, ShopifyProductVariant } from './approvalDraftTypes.js';
import { CONDITION_LABELS, SHOPIFY_DEFAULT_VENDOR, SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES } from './approvalDraftTypes.js';

function hasAnyFieldValue(fields: ApprovalFieldMap, candidates: string[]): boolean {
  return candidates.some((candidate) => {
    const raw = getRawField(fields, [candidate]);
    return Array.isArray(raw) ? raw.length > 0 : getField(fields, [candidate]).length > 0;
  });
}

function hasFlatOptionFields(fields: ApprovalFieldMap): boolean {
  const candidates: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    candidates.push(`Shopify REST Option ${i} Name`, `Shopify Option ${i} Name`, `Shopify GraphQL Option ${i} Name`, `shopify_rest_option_${i}_name`);
    for (let j = 1; j <= 5; j += 1) {
      candidates.push(`Shopify REST Option ${i} Value ${j}`, `Shopify Option ${i} Value ${j}`, `Shopify GraphQL Option ${i} Value ${j}`, `shopify_rest_option_${i}_value_${j}`);
    }
  }
  return hasAnyFieldValue(fields, candidates);
}

function hasFlatVariantFields(fields: ApprovalFieldMap): boolean {
  return hasAnyFieldValue(fields, ['Shopify REST Variant 1 Price', 'shopify_rest_variant_1_price', 'Shopify REST Variant 1 Compare At Price', 'shopify_rest_variant_1_compare_at_price', 'Variant-Compare-Price', 'Variant Compare Price', 'variant_compare_price', 'Shopify REST Variant 1 SKU', 'shopify_rest_variant_1_sku', 'Shopify REST Variant 1 Option 1', 'shopify_rest_variant_1_option_1']);
}

function getConditionFromFields(fields: ApprovalFieldMap): string | undefined {
  return normalizeConditionLabel(getField(fields, ['__Condition__', 'Item Condition', 'Condition', 'Shopify Condition', 'Shopify REST Condition', 'eBay Inventory Condition']));
}

function applyConditionToShopifyOptionsAndVariants(
  options: ShopifyProductOption[] | undefined,
  variants: ShopifyProductVariant[],
  condition: string | undefined,
): { options: ShopifyProductOption[] | undefined; variants: ShopifyProductVariant[] } {
  if (!condition) return { options, variants };
  const nextOptions = (options ?? []).map((option, index) => ({ ...option, position: option.position ?? index + 1, values: [...option.values] }));
  let conditionIndex = nextOptions.findIndex((option) => option.name.trim().toLowerCase() === 'condition');
  if (conditionIndex === -1) {
    if (nextOptions.length < 3) {
      nextOptions.push({ name: 'Condition', position: nextOptions.length + 1, values: [condition] });
      conditionIndex = nextOptions.length - 1;
    } else {
      conditionIndex = 0;
      nextOptions[0] = { name: 'Condition', position: 1, values: [condition] };
    }
  } else {
    const existingValues = nextOptions[conditionIndex].values.filter((value) => CONDITION_LABELS.includes(value as (typeof CONDITION_LABELS)[number]));
    nextOptions[conditionIndex].values = Array.from(new Set([condition, ...existingValues]));
  }
  const conditionPosition = nextOptions[conditionIndex].position ?? conditionIndex + 1;
  const nextVariants = variants.map((variant) => {
    if (conditionPosition === 1) return { ...variant, option1: condition };
    if (conditionPosition === 2) return { ...variant, option2: condition };
    if (conditionPosition === 3) return { ...variant, option3: condition };
    return variant;
  });
  return { options: nextOptions, variants: nextVariants };
}

function buildMetafields(fields: ApprovalFieldMap): ShopifyMetafield[] | undefined {
  const metafields: ShopifyMetafield[] = [];
  for (let i = 1; i <= 30; i += 1) {
    const namespace = getField(fields, [`Shopify REST Metafield ${i} Namespace`, `Shopify Metafield ${i} Namespace`, `Shopify Extra Metafield ${i} Namespace`, `Shopify GraphQL Metafield ${i} Namespace`]);
    const key = getField(fields, [`Shopify REST Metafield ${i} Key`, `Shopify Metafield ${i} Key`, `Shopify Extra Metafield ${i} Key`, `Shopify GraphQL Metafield ${i} Key`]);
    const type = getField(fields, [`Shopify REST Metafield ${i} Type`, `Shopify Metafield ${i} Type`, `Shopify Extra Metafield ${i} Type`, `Shopify GraphQL Metafield ${i} Type`]);
    const value = getField(fields, [`Shopify REST Metafield ${i} Value`, `Shopify Metafield ${i} Value`, `Shopify Extra Metafield ${i} Value`, `Shopify GraphQL Metafield ${i} Value`]);
    if (!namespace || !key || !type || !value) continue;
    const normalizedNamespace = namespace.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    const normalizedType = type.trim().toLowerCase();
    if (normalizedNamespace.length < 2 || normalizedNamespace.length > 255) continue;
    if (normalizedKey.length < 2 || normalizedKey.length > 64) continue;
    if (!/^[a-z_]+(?:\.[a-z_]+)*$/i.test(normalizedType)) continue;
    metafields.push({ namespace: normalizedNamespace, key: normalizedKey, type: normalizedType, value: value.trim() });
  }
  const seoTitle = getField(fields, ['Shopify Extra SEO Title', 'Shopify GraphQL SEO Title']);
  const seoDescription = getField(fields, ['Shopify Extra SEO Description', 'Shopify GraphQL SEO Description']);
  if (seoTitle) metafields.push({ namespace: 'global', key: 'title_tag', type: 'single_line_text_field', value: seoTitle });
  if (seoDescription) metafields.push({ namespace: 'global', key: 'description_tag', type: 'single_line_text_field', value: seoDescription });
  if (metafields.length === 0) return undefined;
  const deduped = new Map<string, ShopifyMetafield>();
  metafields.forEach((metafield) => deduped.set(`${metafield.namespace}:${metafield.key}`, metafield));
  return Array.from(deduped.values());
}

function buildOptions(fields: ApprovalFieldMap): ShopifyProductOption[] {
  if (!hasFlatOptionFields(fields)) {
    const optionsJson = parseJsonArray<ShopifyProductOption>(getRawField(fields, ['Shopify REST Options JSON', 'shopify_rest_options_json']));
    if (optionsJson && optionsJson.length > 0) {
      return optionsJson.filter((option) => option && typeof option.name === 'string' && Array.isArray(option.values));
    }
  }
  const options: ShopifyProductOption[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const name = getField(fields, [`Shopify REST Option ${i} Name`, `Shopify Option ${i} Name`, `Shopify GraphQL Option ${i} Name`, `shopify_rest_option_${i}_name`, `shopify_option_${i}_name`]);
    if (!name) continue;
    const values: string[] = [];
    for (let j = 1; j <= 5; j += 1) {
      const value = getField(fields, [`Shopify REST Option ${i} Value ${j}`, `Shopify Option ${i} Value ${j}`, `Shopify GraphQL Option ${i} Value ${j}`, `shopify_rest_option_${i}_value_${j}`, `shopify_option_${i}_value_${j}`]);
      if (value) values.push(value);
    }
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 0) continue;
    options.push({ name, position: i, values: uniqueValues });
  }
  return options;
}

function buildVariant(fields: ApprovalFieldMap, options: ShopifyProductOption[]): ShopifyProductVariant {
  const option1 = getField(fields, ['Shopify REST Variant 1 Option 1', 'shopify_rest_variant_1_option_1']) || options[0]?.values[0] || null;
  const option2 = getField(fields, ['Shopify REST Variant 1 Option 2', 'shopify_rest_variant_1_option_2']) || options[1]?.values[0] || null;
  const option3 = getField(fields, ['Shopify REST Variant 1 Option 3', 'shopify_rest_variant_1_option_3']) || options[2]?.values[0] || null;
  const compareAtPrice = getField(fields, ['Shopify REST Variant 1 Compare At Price', 'Shopify Variant 1 Compare At Price', 'shopify_rest_variant_1_compare_at_price']);
  const variantComparePrice = getField(fields, ['Variant-Compare-Price', 'Variant Compare Price', 'variant_compare_price']);
  const basePrice = getField(fields, ['Shopify REST Variant 1 Price', 'Shopify Variant 1 Price', 'Price', 'shopify_rest_variant_1_price']);
  const listingPrice = variantComparePrice || compareAtPrice || basePrice;
  const numericListingPrice = Number(listingPrice);
  const numericBasePrice = Number(basePrice);
  const shouldIncludeCompareAt = Number.isFinite(numericListingPrice) && Number.isFinite(numericBasePrice) && numericBasePrice > numericListingPrice;
  const inventoryQuantity = parseInteger(getField(fields, ['Shopify REST Variant 1 Inventory Quantity', 'Shopify Variant 1 Inventory Quantity', 'Quantity', 'Qty', 'shopify_rest_variant_1_inventory_quantity']));
  const inventoryManagement = getField(fields, ['Shopify REST Variant 1 Inventory Management', 'shopify_rest_variant_1_inventory_management']) || undefined;
  return {
    ...(listingPrice ? { price: listingPrice } : {}),
    compare_at_price: shouldIncludeCompareAt ? basePrice : undefined,
    sku: getField(fields, ['Shopify REST Variant 1 SKU', 'SKU', 'shopify_rest_variant_1_sku']) || undefined,
    barcode: getField(fields, ['Shopify REST Variant 1 Barcode', 'shopify_rest_variant_1_barcode']) || undefined,
    inventory_quantity: inventoryQuantity,
    inventory_management: inventoryManagement ?? (typeof inventoryQuantity === 'number' ? 'shopify' : undefined),
    inventory_policy: getField(fields, ['Shopify REST Variant 1 Inventory Policy', 'shopify_rest_variant_1_inventory_policy']) || undefined,
    fulfillment_service: getField(fields, ['Shopify REST Variant 1 Fulfillment Service', 'shopify_rest_variant_1_fulfillment_service']) || undefined,
    taxable: parseBoolean(getField(fields, ['Shopify REST Variant 1 Taxable', 'shopify_rest_variant_1_taxable']), true),
    requires_shipping: parseBoolean(getField(fields, ['Shopify REST Variant 1 Requires Shipping', 'shopify_rest_variant_1_requires_shipping']), true),
    weight: parseNumber(getField(fields, ['Shopify REST Variant 1 Weight', 'shopify_rest_variant_1_weight'])),
    weight_unit: getField(fields, ['Shopify REST Variant 1 Weight Unit', 'shopify_rest_variant_1_weight_unit']) || undefined,
    option1,
    option2,
    option3,
  };
}

function buildVariants(fields: ApprovalFieldMap, options: ShopifyProductOption[]): ShopifyProductVariant[] {
  if (!hasFlatVariantFields(fields)) {
    const variantsJson = parseJsonArray<ShopifyProductVariant>(getRawField(fields, ['Shopify REST Variants JSON', 'Shopify Variants JSON', 'shopify_rest_variants_json']));
    if (variantsJson && variantsJson.length > 0) return variantsJson;
  }
  return [buildVariant(fields, options)];
}

function sanitizeOptions(options: ShopifyProductOption[] | undefined): ShopifyProductOption[] | undefined {
  if (!options || options.length === 0) return undefined;
  const sanitized = options.map((option, index) => ({
    name: option?.name?.trim() ?? '',
    position: index + 1,
    values: Array.from(new Set((option?.values ?? []).map((value) => value.trim()).filter(Boolean))),
  })).filter((option) => option.name.length > 0 && option.values.length > 0);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeVariants(variants: ShopifyProductVariant[] | undefined): ShopifyProductVariant[] {
  const source = variants && variants.length > 0 ? variants : [{} as ShopifyProductVariant];
  return source.map((variant) => {
    const rawPrice = typeof variant.price === 'string' ? variant.price.trim() : '';
    const price = rawPrice ? toMoneyString(rawPrice) : undefined;
    const compareAt = typeof variant.compare_at_price === 'string' ? variant.compare_at_price.trim() : undefined;
    const sku = typeof variant.sku === 'string' ? variant.sku.trim() : undefined;
    const barcode = typeof variant.barcode === 'string' ? variant.barcode.trim() : undefined;
    const inventoryQuantity = typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : parseInteger(String(variant.inventory_quantity ?? ''));
    const inventoryManagement = normalizeInventoryManagement(variant.inventory_management);
    const inventoryPolicy = normalizeInventoryPolicy(variant.inventory_policy);
    const weight = typeof variant.weight === 'number' ? variant.weight : parseNumber(String(variant.weight ?? ''));
    const weightUnit = normalizeWeightUnit(variant.weight_unit);
    return {
      ...(price ? { price } : {}),
      compare_at_price: (() => {
        if (!compareAt) return undefined;
        const normalizedCompareAt = toMoneyString(compareAt, compareAt);
        const priceNum = Number(price);
        const compareNum = Number(normalizedCompareAt);
        if (!Number.isFinite(priceNum) || !Number.isFinite(compareNum)) return undefined;
        return compareNum > priceNum ? normalizedCompareAt : undefined;
      })(),
      sku,
      barcode,
      inventory_quantity: inventoryQuantity,
      inventory_management: inventoryManagement,
      inventory_policy: inventoryPolicy,
      fulfillment_service: variant.fulfillment_service,
      taxable: typeof variant.taxable === 'boolean' ? variant.taxable : undefined,
      requires_shipping: typeof variant.requires_shipping === 'boolean' ? variant.requires_shipping : undefined,
      weight,
      weight_unit: weightUnit,
      option1: typeof variant.option1 === 'string' ? variant.option1.trim() || undefined : undefined,
      option2: typeof variant.option2 === 'string' ? variant.option2.trim() || undefined : undefined,
      option3: typeof variant.option3 === 'string' ? variant.option3.trim() || undefined : undefined,
    };
  });
}

function sanitizeImages(images: ShopifyProduct['images'] | undefined): ShopifyProduct['images'] | undefined {
  if (!images || images.length === 0) return undefined;
  const sanitized = images.map((image, index) => ({
    src: image?.src?.trim() ?? '',
    alt: typeof image?.alt === 'string' ? image.alt.trim() : '',
    position: typeof image?.position === 'number' ? image.position : index + 1,
  })).filter((image) => image.src.length > 0);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeProductPayload(product: ShopifyProduct): ShopifyProduct {
  const options = sanitizeOptions(product.options);
  const variants = sanitizeVariants(product.variants);
  const metafields = product.metafields?.map((metafield) => ({
    namespace: metafield.namespace.trim(),
    key: metafield.key.trim(),
    type: metafield.type.trim(),
    value: metafield.value.trim(),
  })).filter((metafield) => metafield.namespace && metafield.key && metafield.type && metafield.value);
  const normalizedVariants = variants.map((variant) => {
    const next = { ...variant };
    if (!options || options.length === 0) {
      delete next.option1;
      delete next.option2;
      delete next.option3;
    }
    return next;
  });
  return {
    title: product.title.trim() || 'Untitled Listing',
    body_html: product.body_html?.trim() || undefined,
    vendor: product.vendor?.trim() || undefined,
    product_type: trimShopifyProductType(product.product_type ?? '') || undefined,
    handle: product.handle?.trim() || undefined,
    status: normalizeStatus(product.status) ?? 'draft',
    tags: product.tags?.trim() || undefined,
    published_scope: normalizePublishedScope(product.published_scope),
    template_suffix: product.template_suffix?.trim() || undefined,
    variants: normalizedVariants,
    options,
    images: sanitizeImages(product.images),
    metafields: metafields && metafields.length > 0 ? metafields : undefined,
  };
}

export function buildShopifyDraftProductFromApprovalFields(fields: ApprovalFieldMap): ShopifyProduct {
  const condition = getConditionFromFields(fields);
  let options = sanitizeOptions(buildOptions(fields));
  let variants = sanitizeVariants(buildVariants(fields, options ?? []));
  ({ options, variants } = applyConditionToShopifyOptionsAndVariants(options, variants, condition));
  const images = sanitizeImages(buildImages(fields));
  const metafields = buildMetafields(fields);
  const candidate: ShopifyProduct = {
    title: getField(fields, ['Shopify REST Title', 'Shopify Title', 'Shopify GraphQL Title', 'Item Title', 'Title', 'Name', 'shopify_rest_title']) || 'Untitled Listing',
    body_html: resolveShopifyBodyHtml(fields) || undefined,
    vendor: SHOPIFY_DEFAULT_VENDOR,
    product_type: trimShopifyProductType(getField(fields, [...SHOPIFY_PRODUCT_TYPE_FIELD_CANDIDATES])) || undefined,
    handle: getHandleField(fields) || undefined,
    published_at: getField(fields, ['Shopify REST Published At', 'Shopify Published At']) || undefined,
    published_scope: getField(fields, ['Shopify REST Published Scope', 'Shopify Published Scope', 'shopify_rest_published_scope']) || undefined,
    template_suffix: getField(fields, ['Shopify REST Template Suffix', 'Shopify Template Suffix', 'Shopify GraphQL Template Suffix', 'shopify_rest_template_suffix']) || undefined,
    tags: buildTags(fields),
    status: normalizeStatus(getField(fields, ['Shopify REST Status', 'Shopify Status', 'Shopify GraphQL Status'])) ?? 'draft',
    options,
    variants,
    images,
    metafields,
  };
  return sanitizeProductPayload(candidate);
}